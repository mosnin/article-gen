"""PerformanceCoach tools — corpus + GSC trend fetch and alert persistence.

`list_user_articles_with_gsc` POSTs `/api/internal/list-articles-with-gsc`
to pull each published article's 30d GSC performance and the prior 30d
baseline so the agent can detect declines without doing per-article RPCs.

`save_performance_alerts` persists the agent's `PerformanceAlert[]` via
`/api/internal/save-performance-alerts`.

The agent reuses `fetch_article` (from refresh tools) and the existing
`/api/internal/gsc-article-performance` proxy when it needs to deep-dive
into a single article (e.g. to inspect top queries for a CTR collapse).
"""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def list_user_articles_with_gsc(
    user_id: str, limit: int = 100, period_days: int = 30
) -> dict:
    """Pull the user's published articles with 30d GSC performance and a prior
    30d baseline for each one. The route handles GSC token refresh, calls the
    Search Console API per article (filtering by the article's public URL),
    and returns clicks / impressions / position / ctr for both windows plus
    a precomputed change percentage.

    Returns:
      {
        "gscConnected": bool,
        "articles": [
          {
            "id", "title", "slug", "focusKeyword",
            "current":  {"clicks", "impressions", "position", "ctr"},
            "baseline": {"clicks", "impressions", "position", "ctr"},
            "changePct": {"clicks", "impressions", "position", "ctr"}
          },
          ...
        ]
      }

    If GSC is not connected, returns {"gscConnected": false, "articles": []}
    so the agent can surface that gracefully.
    """
    return await post_internal(
        "/list-articles-with-gsc",
        {"userId": user_id, "limit": limit, "periodDays": period_days},
    )


@function_tool
async def save_performance_alerts(user_id: str, alerts: list[dict]) -> dict:
    """Persist the diagnosed PerformanceAlerts.

    Each alert dict matches the PerformanceAlert Pydantic shape:
      {articleId, metricName, periodDays, baselineValue, currentValue,
       changePct, severity, diagnosedCause, recommendedKind, rationale}

    Returns {"insertedCount": int}.
    """
    return await post_internal(
        "/save-performance-alerts",
        {"userId": user_id, "runId": get_run_id(), "alerts": alerts},
    )
