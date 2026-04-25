-- ═══ Tier 2 capability tables + agent_runs.kind widening ═══════════════════
set search_path = public, extensions;

-- Widen agent_runs.kind to include 4 Tier 2 kinds
do $$ begin
  alter table public.agent_runs drop constraint if exists agent_runs_kind_check;
  alter table public.agent_runs add constraint agent_runs_kind_check
    check (kind in (
      'article','autopilot','cluster','research_only',
      'refresh','audit','cluster_plan','social_snippet','keyword_harvest',
      'topic_research','research_and_write',
      'competitor_monitor','internal_link_optimize','schema_doctor','content_brief',
      'seasonal_calendar','cannibalization_resolve','image_optimize','performance_coach'
    ));
end $$;

-- 1. seasonal_recommendations (SeasonalCalendarAgent output)
create table if not exists public.seasonal_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  topic text not null,
  focus_keyword text not null,
  rationale text not null default '',
  signal_type text not null default 'evergreen_seasonal'
    check (signal_type in ('seasonal_event','recurring_topic','holiday','industry_cycle','evergreen_seasonal')),
  recommended_publish_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','scheduled','written','expired')),
  written_article_id uuid references public.articles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_seasonal_recs_user_status
  on public.seasonal_recommendations(user_id, status, recommended_publish_at);

-- 2. cannibalization_resolutions (CannibalizationResolverAgent output)
create table if not exists public.cannibalization_resolutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  primary_article_id uuid not null references public.articles(id) on delete cascade,
  secondary_article_id uuid not null references public.articles(id) on delete cascade,
  similarity_score numeric(4,3) not null check (similarity_score >= 0 and similarity_score <= 1),
  shared_keywords jsonb not null default '[]'::jsonb,
  recommended_action text not null
    check (recommended_action in ('merge','canonical','archive_secondary','retarget_secondary','no_action')),
  rationale text not null default '',
  status text not null default 'pending'
    check (status in ('pending','applied','dismissed','partially_applied')),
  applied_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_cannib_user_status
  on public.cannibalization_resolutions(user_id, status, similarity_score desc);
create unique index if not exists idx_cannib_pair_unique
  on public.cannibalization_resolutions(user_id, least(primary_article_id, secondary_article_id),
                                         greatest(primary_article_id, secondary_article_id));

-- 3. image_optimization_recommendations (ImageOptimizerAgent output)
create table if not exists public.image_optimization_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  article_id uuid not null references public.articles(id) on delete cascade,
  image_index integer not null,
  image_storage_path text,
  issue text not null
    check (issue in ('missing_alt','generic_alt','oversized','no_webp','low_resolution','broken','other')),
  recommended_action text not null
    check (recommended_action in ('generate_alt','regenerate','compress','convert_webp','remove')),
  current_value text,
  recommended_value text,
  status text not null default 'pending'
    check (status in ('pending','applied','dismissed')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_image_opts_user_status
  on public.image_optimization_recommendations(user_id, status, created_at desc);
create index if not exists idx_image_opts_article
  on public.image_optimization_recommendations(article_id);

-- 4. performance_alerts (PerformanceCoachAgent output)
create table if not exists public.performance_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  article_id uuid not null references public.articles(id) on delete cascade,
  metric_name text not null check (metric_name in ('clicks','impressions','position','ctr')),
  period_days integer not null default 30,
  baseline_value numeric not null,
  current_value numeric not null,
  change_pct numeric not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  diagnosed_cause text,
  recommended_kind text check (recommended_kind in ('refresh','rewrite','archive','add_internal_links','add_schema','no_action')),
  rationale text not null default '',
  status text not null default 'pending'
    check (status in ('pending','queued','applied','dismissed')),
  triggered_run_id uuid references public.agent_runs(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_perf_alerts_user_status
  on public.performance_alerts(user_id, status, severity, created_at desc);
create index if not exists idx_perf_alerts_article
  on public.performance_alerts(article_id);

-- RLS for the 4 new tables (per-user select/update/delete; insert is service-role)
alter table public.seasonal_recommendations enable row level security;
alter table public.cannibalization_resolutions enable row level security;
alter table public.image_optimization_recommendations enable row level security;
alter table public.performance_alerts enable row level security;

-- seasonal_recommendations
do $$ begin
  create policy "users select own seasonal_recommendations" on public.seasonal_recommendations
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own seasonal_recommendations" on public.seasonal_recommendations
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own seasonal_recommendations" on public.seasonal_recommendations
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- cannibalization_resolutions
do $$ begin
  create policy "users select own cannibalization_resolutions" on public.cannibalization_resolutions
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own cannibalization_resolutions" on public.cannibalization_resolutions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own cannibalization_resolutions" on public.cannibalization_resolutions
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- image_optimization_recommendations
do $$ begin
  create policy "users select own image_optimization_recommendations" on public.image_optimization_recommendations
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own image_optimization_recommendations" on public.image_optimization_recommendations
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own image_optimization_recommendations" on public.image_optimization_recommendations
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- performance_alerts
do $$ begin
  create policy "users select own performance_alerts" on public.performance_alerts
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own performance_alerts" on public.performance_alerts
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own performance_alerts" on public.performance_alerts
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Realtime
do $$ begin alter publication supabase_realtime add table public.seasonal_recommendations;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.cannibalization_resolutions;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.image_optimization_recommendations;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.performance_alerts;
exception when duplicate_object then null; when undefined_object then null; end $$;
