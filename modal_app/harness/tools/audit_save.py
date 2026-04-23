"""Audit report persistence. Routes through /api/internal/save-audit."""
from __future__ import annotations

from modal_app.harness.tools.http import post_internal


async def save_audit(
    *,
    user_id: str,
    article_id: str,
    gsc_snapshot: dict,
    recommendations: list[dict],
    overall_score: float,
    decided_action: str = "pending",
) -> dict:
    # run_id is propagated via the X-Agent-Run-Id header set by http.post_internal
    return await post_internal(
        "/save-audit",
        {
            "userId": user_id,
            "articleId": article_id,
            "gscSnapshot": gsc_snapshot,
            "recommendations": recommendations,
            "overallScore": overall_score,
            "decidedAction": decided_action,
        },
    )
