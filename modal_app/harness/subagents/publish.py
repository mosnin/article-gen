"""PublishAgent: multi-platform publishing via /api/internal/publish-article.

Input brief: articleId, list of PlatformTarget.

Output: PublishResult (raw per-platform result dicts).

NOTE: The /api/internal/publish-article route currently returns
`platform_requires_session_refactor` for every platform until a
helper-extraction PR factors the platform publish logic out of the
session-gated routes. This subagent still exists so the orchestrator can
call it uniformly; once the refactor lands the subagent keeps working.
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

Given an articleId and a list of platforms in the brief, call
`publish_article(user_id, article_id, platforms)` exactly once with the
full list and return the PublishResult JSON as final_output.

If any platform entry has `success: false` and
`error: "platform_requires_session_refactor"`, that is an expected
temporary state; include it verbatim in the results. Do NOT retry.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="PublishAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[publish_article],
        output_type=PublishResult,
    )
