"""Keyword candidate upsert. Routes through /api/internal/upsert-keyword-candidates."""
from __future__ import annotations

from modal_app.harness.tools.http import post_internal


async def upsert(*, user_id: str, candidates: list[dict]) -> dict:
    return await post_internal(
        "/upsert-keyword-candidates",
        {"userId": user_id, "candidates": candidates},
    )
