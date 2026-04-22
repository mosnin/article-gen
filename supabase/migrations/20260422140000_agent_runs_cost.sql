-- ═══ agent_runs cost + token telemetry columns ═════════════════════════════
-- Idempotent; safe to re-run.
--
-- Adds per-run token accounting (`tokens_in`, `tokens_out`) and USD cost
-- (`cost_usd`) columns to `agent_runs`. Values are populated by the Modal
-- harness when a run completes (aggregated from the Agents SDK's
-- `RunResult.raw_responses[*].usage` and priced via the table in
-- `modal_app/harness/usage.py`).

set search_path = public, extensions;

alter table public.agent_runs
  add column if not exists tokens_in integer not null default 0,
  add column if not exists tokens_out integer not null default 0,
  add column if not exists cost_usd numeric(10, 4) not null default 0;
