-- ═══ Tier 1 capability tables + agent_runs.kind widening ═══════════════════
set search_path = public, extensions;

-- 1. Widen agent_runs.kind to include 4 new kinds
do $$ begin
  alter table public.agent_runs drop constraint if exists agent_runs_kind_check;
  alter table public.agent_runs add constraint agent_runs_kind_check
    check (kind in (
      'article','autopilot','cluster','research_only',
      'refresh','audit','cluster_plan','social_snippet','keyword_harvest',
      'topic_research','research_and_write',
      'competitor_monitor','internal_link_optimize','schema_doctor','content_brief'
    ));
end $$;

-- 2. competitors (user-managed competitor URLs to monitor)
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  feed_url text,
  sitemap_url text,
  label text,
  active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_competitors_user on public.competitors(user_id);
create unique index if not exists idx_competitors_user_domain on public.competitors(user_id, lower(domain));

-- 3. competitor_articles (discovered + classified competitor posts)
create table if not exists public.competitor_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competitor_id uuid references public.competitors(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  url text not null,
  title text not null,
  published_at timestamptz,
  classification text check (classification in ('informational','comparison','launch','tutorial','listicle','news','other')),
  rebuttal_topic text,
  rebuttal_focus_keyword text,
  rebuttal_angle text,
  status text not null default 'discovered' check (status in ('discovered','dismissed','queued','written')),
  written_article_id uuid references public.articles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_competitor_articles_user_status
  on public.competitor_articles(user_id, status, created_at desc);
create unique index if not exists idx_competitor_articles_user_url
  on public.competitor_articles(user_id, lower(url));

-- 4. link_suggestions (InternalLinkOptimizer output)
create table if not exists public.link_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  source_article_id uuid not null references public.articles(id) on delete cascade,
  target_article_id uuid not null references public.articles(id) on delete cascade,
  anchor_text text not null,
  context_snippet text,
  confidence numeric(4,3) not null default 0
    check (confidence >= 0 and confidence <= 1),
  status text not null default 'pending'
    check (status in ('pending','applied','dismissed')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_link_suggestions_user_status
  on public.link_suggestions(user_id, status, created_at desc);
create index if not exists idx_link_suggestions_source
  on public.link_suggestions(source_article_id);

-- 5. schema_diagnoses (SchemaDoctor output)
create table if not exists public.schema_diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  current_schema jsonb,
  recommended_schema jsonb not null,
  recommendations jsonb not null default '[]'::jsonb,
  validation_status text not null default 'pending'
    check (validation_status in ('pending','valid','invalid','warnings')),
  validation_errors jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','applied','dismissed')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_schema_diagnoses_user_status
  on public.schema_diagnoses(user_id, status, created_at desc);
create index if not exists idx_schema_diagnoses_article
  on public.schema_diagnoses(article_id);

-- 6. content_briefs (ContentBrief pre-write artifacts)
create table if not exists public.content_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  topic text not null,
  focus_keyword text not null,
  target_word_count integer not null default 1500,
  must_cover_entities jsonb not null default '[]'::jsonb,
  must_link_sources jsonb not null default '[]'::jsonb,
  reader_persona text,
  intent text check (intent in ('informational','commercial','transactional','navigational')),
  estimated_reading_time integer,
  outline_hint jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','written')),
  written_article_id uuid references public.articles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_content_briefs_user_status
  on public.content_briefs(user_id, status, created_at desc);

-- RLS for the 5 new tables
alter table public.competitors enable row level security;
alter table public.competitor_articles enable row level security;
alter table public.link_suggestions enable row level security;
alter table public.schema_diagnoses enable row level security;
alter table public.content_briefs enable row level security;

-- Per-user CRUD policies (mirroring existing tables)
do $$ begin create policy "users select own competitors" on public.competitors
  for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users insert own competitors" on public.competitors
  for insert with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users update own competitors" on public.competitors
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users delete own competitors" on public.competitors
  for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- For the 4 agent-output tables: SELECT + UPDATE + DELETE (insert is service-role)
do $$ begin
  create policy "users select own competitor_articles" on public.competitor_articles
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own competitor_articles" on public.competitor_articles
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own competitor_articles" on public.competitor_articles
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users select own link_suggestions" on public.link_suggestions
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own link_suggestions" on public.link_suggestions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own link_suggestions" on public.link_suggestions
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users select own schema_diagnoses" on public.schema_diagnoses
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own schema_diagnoses" on public.schema_diagnoses
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users select own content_briefs" on public.content_briefs
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own content_briefs" on public.content_briefs
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Realtime
do $$ begin alter publication supabase_realtime add table public.competitors;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.competitor_articles;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.link_suggestions;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.schema_diagnoses;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.content_briefs;
exception when duplicate_object then null; when undefined_object then null; end $$;
