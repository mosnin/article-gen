-- ═══ agent autonomous schedules + agent_events unique seq ═══════════════════
-- Idempotent; safe to re-run.
--
-- Two concerns:
--   1. Adds `user_settings.autonomous_schedules` JSONB (spec §10) — stores the
--      list of `{ id, userId, name, cadence, niche, tone, targetAudience,
--      platforms, status, nextRunAt }` schedules per user.
--   2. Promotes the non-unique `idx_agent_events_run_seq` index on
--      `agent_events(run_id, seq)` to a UNIQUE index so duplicate webhook
--      deliveries are rejected at the database level. The old non-unique
--      index is dropped because the new unique index covers the same access
--      path.

set search_path = public, extensions;

-- 1. autonomous_schedules JSONB on user_settings (spec §10)
alter table public.user_settings
  add column if not exists autonomous_schedules jsonb not null default '[]'::jsonb;

-- 2. Unique index on agent_events(run_id, seq) so webhook duplicates are
--    rejected at DB level.
do $$ begin
  create unique index idx_agent_events_run_seq_unique
    on public.agent_events (run_id, seq);
exception when duplicate_table then null;
end $$;

-- Drop the non-unique index that the original migration created so queries
-- still benefit from the index (the unique index covers the same access path).
drop index if exists idx_agent_events_run_seq;
