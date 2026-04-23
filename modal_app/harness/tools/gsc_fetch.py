"""GSC performance fetch. Routes through /api/internal/gsc-article-performance."""
from __future__ import annotations

from modal_app.harness.tools.http import post_internal


async def fetch_article_performance(
    user_id: str, article_id: str, days: int = 28
) -> dict:
    return await post_internal(
        "/gsc-article-performance",
        {"userId": user_id, "articleId": article_id, "days": days},
    )
