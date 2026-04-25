"""Persistence for topic proposals."""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def save_topic_proposals(user_id: str, niche: str, proposals: list[dict]) -> dict:
    """Persist a list of vetted topic proposals to Supabase. Returns {ids: [str]}."""
    run_id = get_run_id()
    return await post_internal(
        "/save-topic-proposals",
        {"userId": user_id, "runId": run_id, "niche": niche, "proposals": proposals},
    )
