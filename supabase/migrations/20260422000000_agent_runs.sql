-- ============================================================================
-- Agentic Article Generation — agent_runs + agent_events
-- See: docs/project/09_agentic_generation.md §4 (schema) and §8 (realtime)
--
-- Creates:
--   * public.agent_runs       — one row per user-initiated / autonomous run
--   * public.agent_events     — append-only timeline per run (for streaming)
--   * indexes, RLS policies, updated_at trigger, realtime publication entries
--
-- All statements are idempotent — safe to re-run after a partial rollback.
-- ============================================================================

-- Ensure gen_random_uuid() is available (no-op if already installed)
create extension if not exists pgcrypto;

-- ── Shared updated_at trigger function ──────────────────────────────────────
-- No pre-existing shared trigger function is available in this repo, so we
-- define a dedicated one here. Named *_agent_runs so it cannot collide with a
-- later generic helper introduced elsewhere.

create or replace function public.set_updated_at_agent_runs()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Table: agent_runs ───────────────────────────────────────────────────────

create table if not exists public.agent_runs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  kind                text not null default 'article'
    check (kind in ('article','autopilot','cluster','research_only')),
  status              text not null default 'pending'
    check (status in ('pending','running','succeeded','failed','cancelled')),
  modal_call_id       text,
  topic               text not null,
  focus_keyword       text,
  tone                text,
  target_audience     text,
  quality             text not null default 'standard'
    check (quality in ('standard','premium')),
  input               jsonb not null default '{}'::jsonb,     -- full trigger payload
  output              jsonb,                                   -- final {articleId, ...}
  options             jsonb not null default '{}'::jsonb,     -- {wpBlogId, autoPublish, imageCount, platforms[]}
  current_step        text,
  current_agent       text,
  progress_pct        int  not null default 0,
  error               text,
  article_id          uuid references public.articles(id) on delete set null,
  autopilot_slot_id   text,
  credits_charged     int  not null default 0,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  updated_at          timestamptz not null default now()
);

create index if not exists idx_agent_runs_user_id
  on public.agent_runs(user_id);
create index if not exists idx_agent_runs_status
  on public.agent_runs(status);
create index if not exists idx_agent_runs_created_at
  on public.agent_runs(created_at desc);

-- updated_at maintenance trigger
drop trigger if exists set_updated_at on public.agent_runs;
create trigger set_updated_at
  before update on public.agent_runs
  for each row
  execute function public.set_updated_at_agent_runs();

-- ── Table: agent_events ─────────────────────────────────────────────────────

create table if not exists public.agent_events (
  id           bigserial primary key,
  run_id       uuid not null references public.agent_runs(id) on delete cascade,
  seq          int  not null,                                  -- monotonic per run
  kind         text not null
    check (kind in ('run_started','run_completed','run_failed','agent_started','agent_ended',
                    'tool_started','tool_ended','message','handoff','progress','warning')),
  agent_name   text,
  tool_name    text,
  message      text,
  payload      jsonb,
  duration_ms  int,
  created_at   timestamptz not null default now()
);

create index if not exists idx_agent_events_run_seq
  on public.agent_events(run_id, seq);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.agent_runs   enable row level security;
alter table public.agent_events enable row level security;

-- agent_runs: users can SELECT / INSERT their own rows. No UPDATE policy —
-- updates happen exclusively via the service role (Modal webhook).
do $$
begin
  create policy "users select own runs" on public.agent_runs
    for select using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "users insert own runs" on public.agent_runs
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- agent_events: users can SELECT events that belong to runs they own.
-- Inserts happen via the service role only.
do $$
begin
  create policy "users select own events" on public.agent_events
    for select using (
      exists (
        select 1 from public.agent_runs r
        where r.id = run_id and r.user_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

-- ── Realtime publication ────────────────────────────────────────────────────
-- Wrap each in its own DO block so that re-running after the tables have
-- already been added to the publication does not fail the migration.

do $$
begin
  alter publication supabase_realtime add table public.agent_runs;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.agent_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
