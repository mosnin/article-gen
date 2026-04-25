-- ═══ Widen article_audits.decided_action CHECK to include 'applied' ══
-- Audit Round 2 F7 added "Apply" buttons whose catch-all kinds (add_schema,
-- fix_internal_links, improve_alt_text, merge_cannibal) write
-- decided_action='applied'. The original CHECK from Wave 6B only allows
-- ('refresh','rewrite','archive','ignore','pending') so writes would 500.
-- Idempotent.

set search_path = public, extensions;

do $$ begin
  alter table public.article_audits drop constraint if exists article_audits_decided_action_check;
  alter table public.article_audits add constraint article_audits_decided_action_check
    check (decided_action in ('refresh','rewrite','archive','ignore','pending','applied'));
end $$;
