-- ═══ Audit-driven schema fixes ════════════════════════════════════════════
set search_path = public, extensions;

-- 1. Missing columns referenced by code
alter table public.articles add column if not exists word_count integer;
alter table public.articles add column if not exists tone text;
alter table public.articles add column if not exists target_audience text;

-- Backfill word_count from existing markdown so /app/articles renders
update public.articles
  set word_count = greatest(0, array_length(regexp_split_to_array(article_markdown, '\s+'), 1))
  where word_count is null and article_markdown is not null;

-- 2. Generic set_updated_at function + apply to articles, clusters, user_settings,
--    user_profiles, autonomous_pending_approvals, topic_proposals
create or replace function public.set_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Helper: attach trigger only if both the table exists AND it has updated_at AND no trigger by that name exists
do $$
declare
  t text;
  tables text[] := array[
    'articles','clusters','user_settings','user_profiles',
    'autonomous_pending_approvals','topic_proposals'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name=t and column_name='updated_at'
    ) and not exists (
      select 1 from pg_trigger where tgname = format('%s_set_updated_at', t)
    ) then
      execute format(
        'create trigger %I_set_updated_at before update on public.%I '
        'for each row execute function public.set_updated_at()',
        t, t
      );
    end if;
  end loop;
end $$;

-- 3. Idempotency constraint on credit_transactions: no double-charge per (user, run, type)
create unique index if not exists idx_credit_transactions_run_type_unique
  on public.credit_transactions (user_id, article_id, type)
  where article_id is not null;
-- Note: keyed on (user_id, article_id, type) since run_id isn't a column. Articles are run-scoped 1:1.

-- 4. Idempotency constraint on articles: at most one row per agent run
-- agent_runs.id can repeat across replays so we use a partial unique index on a column
-- to be added by code via /api/internal/save-article. For now, add a tracking column.
alter table public.articles add column if not exists agent_run_id uuid
  references public.agent_runs(id) on delete set null;
create unique index if not exists idx_articles_agent_run_unique
  on public.articles (agent_run_id)
  where agent_run_id is not null;

-- 5. agent_runs.started_at index for "time to first event" queries
create index if not exists idx_agent_runs_started_at
  on public.agent_runs (started_at desc) where started_at is not null;

-- 6. Drop duplicated articles publish_at index
drop index if exists public.articles_publish_at_idx;
-- idx_articles_publish_at remains.

-- 7. Domain CHECK on topic_proposals.relevance_score (defensive)
do $$ begin
  alter table public.topic_proposals
    add constraint topic_proposals_relevance_range
    check (relevance_score >= 0 and relevance_score <= 1);
exception when duplicate_object then null; end $$;

-- 8. Composite index for hot agent_runs query (user + created_at desc)
create index if not exists idx_agent_runs_user_created
  on public.agent_runs (user_id, created_at desc);
