"""Multi-platform publishing tool.

Routes through /api/internal/publish-article so encrypted platform tokens
stay on Vercel.
"""

from __future__ import annotations

from modal_app.harness.models import PlatformTarget, PublishResult
from modal_app.harness.tools.http import post_internal


async def publish_article(
    user_id: str, article_id: str, platforms: list[PlatformTarget]
) -> PublishResult:
    """POST /api/internal/publish-article. Returns batch-publish results per platform."""
    data = await post_internal(
        "/publish-article",
        {
            "userId": user_id,
            "articleId": article_id,
            "platforms": [p.model_dump() for p in platforms],
        },
    )
    return PublishResult(results=list(data.get("results", [])))
