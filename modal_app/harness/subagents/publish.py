"""PublishAgent: multi-platform publishing via /api/internal/publish-article.

Input brief: articleId, list of PlatformTarget.

Output: PublishResult (raw per-platform result dicts).
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import PlatformTarget, PublishResult
from modal_app.harness.tools import publish as publish_tools


@function_tool
async def publish_article(user_id: str, article_id: str, platforms: list[dict]) -> dict:
    """Publish `article_id` to each platform. Returns per-platform results."""
    targets = [PlatformTarget.model_validate(p) for p in platforms]
    result = await publish_tools.publish_article(user_id, article_id, targets)
    return result.model_dump()


INSTRUCTIONS = """
You are PublishAgent.

Call `publish_article(user_id, article_id, platforms)` once with all
requested platforms. Each item in the result's `results[]` array has
`success`, `platform`, optional `postUrl`, optional `error`. Surface
per-platform errors faithfully but do not retry — the user can re-run
if needed.

Return the PublishResult JSON as final_output.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="PublishAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[publish_article],
        output_type=PublishResult,
    )
