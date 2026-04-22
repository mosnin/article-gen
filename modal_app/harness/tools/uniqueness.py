"""Semantic memory / dedup tools.

All Upstash traffic is proxied via /api/internal/* so the Upstash token stays
on Vercel.
"""

from modal_app.harness.models import SimilarArticle
from modal_app.harness.tools.http import post_internal


async def check_uniqueness(
    user_id: str, topic: str, keyword: str, k: int = 5
) -> list[SimilarArticle]:
    data = await post_internal(
        "/check-uniqueness",
        {"userId": user_id, "topic": topic, "keyword": keyword, "k": k},
    )
    return [SimilarArticle.model_validate(x) for x in data.get("similar", [])]


async def upsert_uniqueness_vector(
    user_id: str,
    article_id: str,
    title: str,
    keyword: str,
    topic: str,
    outline: list[str],
) -> None:
    """NOTE: not called from the orchestrator anymore — /api/internal/save-article
    performs this upsert atomically when outlineHeadings is present in the payload.
    Kept for explicit replay / backfill scenarios."""
    await post_internal(
        "/upsert-uniqueness",
        {
            "userId": user_id,
            "articleId": article_id,
            "title": title,
            "keyword": keyword,
            "topic": topic,
            "outline": outline,
        },
    )


async def find_similar_past_articles(
    user_id: str, topic: str, keyword: str, k: int = 5
) -> list[SimilarArticle]:
    """Alias of check_uniqueness — matches the spec §6 tool name used by ResearchAgent."""
    return await check_uniqueness(user_id, topic, keyword, k)
