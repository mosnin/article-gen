-- ═══ Tier 4 capability tables + agent_runs.kind widening ═══════════════════
set search_path = public, extensions;

do $$ begin
  alter table public.agent_runs drop constraint if exists agent_runs_kind_check;
  alter table public.agent_runs add constraint agent_runs_kind_check
    check (kind in (
      'article','autopilot','cluster','research_only',
      'refresh','audit','cluster_plan','social_snippet','keyword_harvest',
      'topic_research','research_and_write',
      'competitor_monitor','internal_link_optimize','schema_doctor','content_brief',
      'seasonal_calendar','cannibalization_resolve','image_optimize','performance_coach',
      'newsletter_digest','social_publish','sponsorship_fit',
      'cost_optimize','prompt_drift_detect','user_segment'
    ));
end $$;

-- 1. cost_optimization_reports (CostOptimizerAgent output, admin/per-user)
create table if not exists public.cost_optimization_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_cost_usd numeric(10,4) not null default 0,
  total_runs int not null default 0,
  cost_by_kind jsonb not null default '{}'::jsonb,    -- {kind: usd}
  recommendations jsonb not null default '[]'::jsonb, -- [{kind, change, estimated_savings_usd, reason}]
  status text not null default 'pending'
    check (status in ('pending','reviewed','applied','dismissed')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_cost_reports_user_status
  on public.cost_optimization_reports(user_id, status, created_at desc);

-- 2. prompt_drift_alerts (PromptDriftDetectorAgent output)
create table if not exists public.prompt_drift_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  scope text not null check (scope in ('global','user')),
  agent_kind text not null,        -- 'article' | 'audit' | etc.
  baseline_score numeric(5,3) not null,
  current_score numeric(5,3) not null,
  delta_pct numeric(6,3) not null,
  sample_size int not null,
  diagnosed_cause text,             -- 'model_snapshot_change' | 'prompt_edit' | 'data_drift' | 'unknown'
  severity text not null check (severity in ('low','medium','high','critical')),
  evidence jsonb not null default '[]'::jsonb,  -- sample run ids + delta details
  status text not null default 'pending'
    check (status in ('pending','acknowledged','resolved','dismissed')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_drift_alerts_status
  on public.prompt_drift_alerts(status, severity, created_at desc);
create index if not exists idx_drift_alerts_user
  on public.prompt_drift_alerts(user_id);

-- 3. user_segments (UserSegmentAgent output — one row per user, latest wins)
create table if not exists public.user_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  persona_label text not null,                        -- short label, e.g. "indie SaaS founder"
  persona_description text not null,                  -- 2-4 sentences
  industry text,
  business_model text,                                -- B2B|B2C|D2C|marketplace|other
  audience_technical_level text,                      -- beginner|intermediate|advanced|mixed
  primary_goals jsonb not null default '[]'::jsonb,   -- list of strings
  brand_voice text,
  content_pillars jsonb not null default '[]'::jsonb,
  tone_keywords jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);
create index if not exists idx_user_segments_user_recent
  on public.user_segments(user_id, created_at desc);

-- RLS
alter table public.cost_optimization_reports enable row level security;
alter table public.prompt_drift_alerts enable row level security;
alter table public.user_segments enable row level security;

-- cost_optimization_reports: select/update/delete own
do $$ begin create policy "users select own cost_optimization_reports" on public.cost_optimization_reports
  for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users update own cost_optimization_reports" on public.cost_optimization_reports
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users delete own cost_optimization_reports" on public.cost_optimization_reports
  for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- prompt_drift_alerts: admin-only SELECT (use is_admin() helper if exists; otherwise allow per-user select on their own user_id rows OR null user_id rows for admins)
-- Simpler: select rows where (user_id IS NULL AND is_admin()) OR (user_id = auth.uid())
do $$ begin create policy "users + admins select drift alerts" on public.prompt_drift_alerts
  for select using (
    (user_id is not null and auth.uid() = user_id)
    or (user_id is null and exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin'))
  ); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins update drift alerts" on public.prompt_drift_alerts
  for update using (
    exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin')
  ); exception when duplicate_object then null; end $$;

-- user_segments: select own only (no update — segments are agent-generated)
do $$ begin create policy "users select own user_segments" on public.user_segments
  for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- Realtime
do $$ begin alter publication supabase_realtime add table public.cost_optimization_reports;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.prompt_drift_alerts;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.user_segments;
exception when duplicate_object then null; when undefined_object then null; end $$;
