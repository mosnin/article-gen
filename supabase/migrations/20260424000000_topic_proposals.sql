-- ═══ topic_proposals + agent_runs.kind widening ════════════════════════════
set search_path = public, extensions;

-- Widen agent_runs.kind to include topic_research + research_and_write
do $$ begin
  alter table public.agent_runs drop constraint if exists agent_runs_kind_check;
  alter table public.agent_runs add constraint agent_runs_kind_check
    check (kind in (
      'article','autopilot','cluster','research_only',
      'refresh','audit','cluster_plan','social_snippet','keyword_harvest',
      'topic_research','research_and_write'
    ));
end $$;

create table if not exists public.topic_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  niche text not null,
  title text not null,
  focus_keyword text not null,
  angle text not null,
  rationale text not null default '',
  relevance_score numeric(4,3) not null default 0,
  evidence_urls jsonb not null default '[]'::jsonb,
  freshness_signal text not null default 'evergreen_gap'
    check (freshness_signal in (
      'news_30d','trending_search','competitor_recent','seasonal','evergreen_gap'
    )),
  competitor_gap boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','written_in_progress','written','expired')),
  rejection_reasons jsonb not null default '[]'::jsonb,
  written_article_id uuid references public.articles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_topic_proposals_user on public.topic_proposals(user_id);
create index if not exists idx_topic_proposals_user_status
  on public.topic_proposals(user_id, status, created_at desc);
create index if not exists idx_topic_proposals_run on public.topic_proposals(run_id);

alter table public.topic_proposals enable row level security;

do $$ begin
  create policy "users select own topic proposals" on public.topic_proposals
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own topic proposals" on public.topic_proposals
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own topic proposals" on public.topic_proposals
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table public.topic_proposals;
exception when duplicate_object then null; when undefined_object then null; end $$;
