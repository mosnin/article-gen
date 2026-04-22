-- ═══ articles lifecycle + user timezone + autonomous approvals ══════════════
-- Idempotent; safe to re-run after a partial rollback.
--
-- Three concerns:
--   1. Adds lifecycle columns to `public.articles` (+ backfill + indexes).
--   2. Adds `public.user_profiles.timezone`.
--   3. Creates `public.autonomous_pending_approvals` (cron-proposed runs that
--      await user decision), plus indexes, RLS policies, and realtime
--      publication entry.

set search_path = public, extensions;

-- ══ articles lifecycle columns + backfill ═══════════════════════════════
alter table public.articles add column if not exists lifecycle text not null default 'draft'
  check (lifecycle in ('draft','scheduled','published','needs_refresh','archived'));
alter table public.articles add column if not exists published_at timestamptz;
alter table public.articles add column if not exists refresh_due_at timestamptz;
alter table public.articles add column if not exists last_refreshed_at timestamptz;
alter table public.articles add column if not exists parent_article_id uuid
  references public.articles(id) on delete set null;

-- Backfill: any already-posted article becomes 'published' with published_at from updated_at.
-- Any article with publish_at in the future becomes 'scheduled'. Safe to re-run.
update public.articles set lifecycle = 'published', published_at = coalesce(published_at, updated_at)
  where posted = true and lifecycle = 'draft';
update public.articles set lifecycle = 'scheduled'
  where posted = false and publish_at is not null and lifecycle = 'draft';

create index if not exists idx_articles_lifecycle on public.articles(lifecycle);
create index if not exists idx_articles_refresh_due on public.articles(refresh_due_at)
  where lifecycle = 'published' and refresh_due_at is not null;

-- ══ user_profiles.timezone ══════════════════════════════════════════════
alter table public.user_profiles add column if not exists timezone text not null default 'UTC';

-- ══ autonomous_pending_approvals table ══════════════════════════════════
create table if not exists public.autonomous_pending_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id text not null,
  topic_suggestion text not null,
  focus_keyword text,
  niche text,
  tone text,
  target_audience text,
  platforms jsonb not null default '[]'::jsonb,
  proposed_run_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired')),
  decided_at timestamptz,
  dispatched_run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_autonomous_approvals_user on public.autonomous_pending_approvals(user_id);
create index if not exists idx_autonomous_approvals_status on public.autonomous_pending_approvals(status, proposed_run_at);

alter table public.autonomous_pending_approvals enable row level security;

do $$ begin
  create policy "users select own approvals" on public.autonomous_pending_approvals
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users update own approvals" on public.autonomous_pending_approvals
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- insert is service-role only (Inngest cron); no insert policy.

-- realtime for approvals inbox
do $$ begin
  alter publication supabase_realtime add table public.autonomous_pending_approvals;
exception when duplicate_object then null; when undefined_object then null; end $$;
