"""GSC query inventory fetch. Routes through /api/internal/gsc-queries."""
from __future__ import annotations

from modal_app.harness.tools.http import post_internal


async def fetch_queries(*, user_id: str, limit: int = 100, days: int = 28) -> dict:
    return await post_internal(
        "/gsc-queries",
        {"userId": user_id, "limit": limit, "days": days},
    )
