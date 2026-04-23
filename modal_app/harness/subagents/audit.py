"""AuditAgent — inspects one or more published articles and emits
structured recommendations (refresh / rewrite / fix schema / etc.).
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import AuditReport
from modal_app.harness.tools import audit_save, exa, gsc_fetch


INSTRUCTIONS = """
You audit a user's published article and propose specific improvements.

For each articleId in the brief:
1. Call fetch_gsc_performance(articleId) to read clicks / impressions /
   avg position / top queries over the last 28 days.
2. Call fetch_article(articleId) to get the current markdown + metadata.
3. Call serp_analyze(focusKeyword) to compare against what currently ranks.
4. Produce an AuditReport:
   - overallScore 0..1 (lower = more work needed)
   - gscSnapshot: clicks/impressions/position/ctr/topQueries
   - recommendations: a list of AuditRecommendation, each with kind
     (refresh | rewrite | add_schema | fix_internal_links |
      improve_alt_text | merge_cannibal | archive), reason, priority
      (low/medium/high), and details.
   - summary: one paragraph for the user.
5. Call save_audit(userId, articleId, gscSnapshot, recommendations,
   overallScore) to persist.
6. Return the AuditReport (or a list of AuditReport if multiple articles)
   as your final_output.

Calibration:
- overallScore = 1.0 means no recommendations (perfect).
- overallScore drops 0.2 per high-priority recommendation, 0.1 per medium,
  0.05 per low, floored at 0.
""".strip()


@function_tool
async def fetch_gsc_performance(
    user_id: str, article_id: str, days: int = 28
) -> dict:
    """Fetch 28-day GSC performance (clicks/impressions/position/queries)."""
    return await gsc_fetch.fetch_article_performance(user_id, article_id, days)


@function_tool
async def fetch_article(article_id: str) -> dict:
    """Fetch the article's current markdown + metadata."""
    # Reuse R1's article_diff helper (tools/article_diff.fetch_article_for_refresh
    # returns the same shape we need here).
    from modal_app.harness.tools.article_diff import fetch_article_for_refresh

    return await fetch_article_for_refresh(article_id)


@function_tool
async def serp_analyze(keyword: str, num_results: int = 10) -> dict:
    """Top-ranking pages for `keyword`: titles, domains, headings, word counts."""
    res = await exa.serp_analyze(keyword, num_results)
    return res.model_dump()


@function_tool
async def save_audit(
    user_id: str,
    article_id: str,
    gsc_snapshot: dict,
    recommendations: list[dict],
    overall_score: float,
    decided_action: str = "pending",
) -> dict:
    """Persist the audit report via /api/internal/save-audit."""
    return await audit_save.save_audit(
        user_id=user_id,
        article_id=article_id,
        gsc_snapshot=gsc_snapshot,
        recommendations=recommendations,
        overall_score=overall_score,
        decided_action=decided_action,
    )


def build_agent() -> Agent:
    return Agent(
        name="AuditAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        output_type=AuditReport,
        tools=[fetch_gsc_performance, fetch_article, serp_analyze, save_audit],
    )
