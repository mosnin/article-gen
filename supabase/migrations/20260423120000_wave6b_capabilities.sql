-- ═══ Wave 6B foundation: audit + cluster_plan + social_snippet + keyword_candidate ═══
-- Idempotent; safe to re-run.

set search_path = public, extensions;

-- ─── 1. Widen agent_runs.kind CHECK to cover new capabilities ──────────────
-- Existing allowed: article, autopilot, cluster, research_only
-- Adding:           refresh, audit, cluster_plan, social_snippet, keyword_harvest
do $$ begin
  alter table public.agent_runs drop constraint if exists agent_runs_kind_check;
  alter table public.agent_runs add constraint agent_runs_kind_check
    check (kind in (
      'article','autopilot','cluster','research_only',
      'refresh','audit','cluster_plan','social_snippet','keyword_harvest'
    ));
end $$;

-- ─── 2. article_audits ─────────────────────────────────────────────────────
create table if not exists public.article_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  gsc_snapshot jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  overall_score numeric(4,2),
  decided_action text check (decided_action in ('refresh','rewrite','archive','ignore','pending')),
  created_at timestamptz not null default now()
);
create index if not exists idx_article_audits_user on public.article_audits(user_id);
create index if not exists idx_article_audits_article on public.article_audits(article_id);
create index if not exists idx_article_audits_created on public.article_audits(created_at desc);

alter table public.article_audits enable row level security;
do $$ begin
  create policy "users select own audits" on public.article_audits
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own audits" on public.article_audits
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
-- inserts are service-role only (Modal webhook path).

-- ─── 3. social_snippets ────────────────────────────────────────────────────
create table if not exists public.social_snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  platform text not null check (platform in ('twitter','linkedin','instagram','facebook','newsletter')),
  variant text not null default 'default',
  body text not null,
  hashtags text[] not null default array[]::text[],
  image_url text,
  scheduled_for timestamptz,
  posted_at timestamptz,
  external_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_social_snippets_user on public.social_snippets(user_id);
create index if not exists idx_social_snippets_article on public.social_snippets(article_id);
create index if not exists idx_social_snippets_scheduled
  on public.social_snippets(scheduled_for)
  where scheduled_for is not null and posted_at is null;

alter table public.social_snippets enable row level security;
do $$ begin
  create policy "users select own snippets" on public.social_snippets
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own snippets" on public.social_snippets
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own snippets" on public.social_snippets
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ─── 4. keyword_candidates ─────────────────────────────────────────────────
create table if not exists public.keyword_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  source text not null check (source in ('gsc_queries','serp_gap','competitor','manual')),
  intent text check (intent in ('informational','commercial','transactional','navigational')),
  estimated_volume int,
  cluster_hint uuid references public.clusters(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','used')),
  used_in_article_id uuid references public.articles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists idx_keyword_candidates_user on public.keyword_candidates(user_id);
create index if not exists idx_keyword_candidates_status
  on public.keyword_candidates(status, created_at desc);
create unique index if not exists idx_keyword_candidates_user_keyword
  on public.keyword_candidates(user_id, lower(keyword));

alter table public.keyword_candidates enable row level security;
do $$ begin
  create policy "users select own keywords" on public.keyword_candidates
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own keywords" on public.keyword_candidates
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own keywords" on public.keyword_candidates
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ─── 5. clusters strategy-plan extension ───────────────────────────────────
alter table public.clusters add column if not exists strategy_plan jsonb;
alter table public.clusters add column if not exists article_target_count int;
alter table public.clusters add column if not exists last_planned_at timestamptz;

-- ─── 6. realtime publication ───────────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table public.article_audits;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.social_snippets;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.keyword_candidates;
exception when duplicate_object then null; when undefined_object then null; end $$;
