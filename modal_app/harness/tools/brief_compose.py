"""ContentBrief tools — niche research + persistence helpers.

The agent already has access to research helpers (serp_analyze,
research_niche, find_similar_past_articles) wrapped as function_tools
inside the subagent module. This file adds the persistence helper used
to write a finished ContentBriefArtifact back to Supabase via the
internal API.
"""
from __future__ import annotations

from modal_app.harness.tools.http import get_run_id, post_internal


async def save_content_brief(user_id: str, brief: dict) -> dict:
    """Persist a ContentBriefArtifact.

    ``brief`` is the camelCase dict matching the Pydantic shape.
    Returns ``{"briefId": "..."}``.
    """
    return await post_internal(
        "/save-content-brief",
        {"userId": user_id, "runId": get_run_id(), "brief": brief},
    )
