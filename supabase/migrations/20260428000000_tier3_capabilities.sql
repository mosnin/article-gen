-- ═══ Tier 3 capability tables + agent_runs.kind widening ═══════════════════
set search_path = public, extensions;

-- Widen agent_runs.kind to include 3 Tier 3 kinds
do $$ begin
  alter table public.agent_runs drop constraint if exists agent_runs_kind_check;
  alter table public.agent_runs add constraint agent_runs_kind_check
    check (kind in (
      'article','autopilot','cluster','research_only',
      'refresh','audit','cluster_plan','social_snippet','keyword_harvest',
      'topic_research','research_and_write',
      'competitor_monitor','internal_link_optimize','schema_doctor','content_brief',
      'seasonal_calendar','cannibalization_resolve','image_optimize','performance_coach',
      'newsletter_digest','social_publish','sponsorship_fit'
    ));
end $$;

-- 1. newsletter_digests (NewsletterDigestAgent output)
create table if not exists public.newsletter_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  period_start date not null,
  period_end date not null,
  subject text not null,
  preheader text,
  intro text not null default '',
  article_ids jsonb not null default '[]'::jsonb,
  body_markdown text not null,
  body_html text,
  status text not null default 'draft'
    check (status in ('draft','approved','scheduled','sent','archived','dismissed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  external_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_newsletters_user_status
  on public.newsletter_digests(user_id, status, created_at desc);
create index if not exists idx_newsletters_scheduled
  on public.newsletter_digests(scheduled_for)
  where scheduled_for is not null and status = 'scheduled';

-- 2. social_accounts (user-managed: minimal placeholder for OAuth-or-webhook publishing)
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('twitter','linkedin','instagram','facebook','newsletter','webhook')),
  display_name text,
  webhook_url text,
  oauth_token text,        -- enc:... encrypted via wp-crypto
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_social_accounts_user on public.social_accounts(user_id);

-- 3. sponsor_fits (SponsorshipFitAgent output)
create table if not exists public.sponsor_fits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  article_id uuid not null references public.articles(id) on delete cascade,
  fit_score numeric(4,3) not null check (fit_score >= 0 and fit_score <= 1),
  monthly_traffic_estimate integer,
  niche_tightness numeric(4,3) check (niche_tightness >= 0 and niche_tightness <= 1),
  evergreen_score numeric(4,3) check (evergreen_score >= 0 and evergreen_score <= 1),
  suggested_sponsor_archetypes jsonb not null default '[]'::jsonb,
  rationale text not null default '',
  status text not null default 'pending'
    check (status in ('pending','pursuing','sponsored','dismissed','expired')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_sponsor_fits_user_status
  on public.sponsor_fits(user_id, status, fit_score desc);

-- RLS for the 3 new tables (per-user select/update/delete; insert is service-role for digests + fits;
-- social_accounts gets full CRUD because users manage them directly)
alter table public.newsletter_digests enable row level security;
alter table public.social_accounts enable row level security;
alter table public.sponsor_fits enable row level security;

-- newsletter_digests: select/update/delete own
do $$ begin create policy "users select own newsletter_digests" on public.newsletter_digests
  for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users update own newsletter_digests" on public.newsletter_digests
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users delete own newsletter_digests" on public.newsletter_digests
  for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- social_accounts: full CRUD
do $$ begin create policy "users select own social_accounts" on public.social_accounts
  for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users insert own social_accounts" on public.social_accounts
  for insert with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users update own social_accounts" on public.social_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users delete own social_accounts" on public.social_accounts
  for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- sponsor_fits: select/update/delete own
do $$ begin create policy "users select own sponsor_fits" on public.sponsor_fits
  for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users update own sponsor_fits" on public.sponsor_fits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users delete own sponsor_fits" on public.sponsor_fits
  for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- Realtime
do $$ begin alter publication supabase_realtime add table public.newsletter_digests;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.social_accounts;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.sponsor_fits;
exception when duplicate_object then null; when undefined_object then null; end $$;
