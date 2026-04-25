"""SeasonalCalendarAgent tools — user-history scan + recommendation persistence.

Reuses the existing /list-articles-for-linking internal route to pull the
user's published-article history (now extended to also return ``topic`` and
``createdAt``). A new /save-seasonal-recommendations route persists the
agent's structured output.
"""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def list_user_published_articles(user_id: str, limit: int = 200) -> dict:
    """Pull the user's recent published articles for pattern detection.

    Returns ``{ articles: [{id, title, slug, topic, focusKeyword,
    keywords, createdAt}] }`` ordered by most-recently-updated. Use the
    ``createdAt`` + ``topic`` fields to detect recurring annual / seasonal
    posting patterns (e.g. "user posts a year-end roundup every December").
    """
    return await post_internal(
        "/list-articles-for-linking",
        {"userId": user_id, "limit": limit},
    )


@function_tool
async def save_seasonal_recommendations(
    user_id: str, recommendations: list[dict]
) -> dict:
    """Persist a list of SeasonalRecommendation entries.

    Each item must be a camelCase dict matching the Pydantic shape:
    ``{topic, focusKeyword, rationale, signalType, recommendedPublishAt}``.
    ``signalType`` is one of: seasonal_event, recurring_topic, holiday,
    industry_cycle, evergreen_seasonal. ``recommendedPublishAt`` must be
    an ISO-8601 datetime within the next 90 days. Returns
    ``{insertedCount}``.
    """
    return await post_internal(
        "/save-seasonal-recommendations",
        {
            "userId": user_id,
            "runId": get_run_id(),
            "recommendations": recommendations,
        },
    )
