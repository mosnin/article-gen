"""ContentBriefAgent — produces a structured pre-write brief.

Decouples planning from writing: a user can review/edit a brief before
spending tokens on a full article. The brief becomes the input to a
later 'article' run via TriggerPayload.contentBriefId.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import ContentBriefArtifact
from modal_app.harness.tools import brief_compose, exa, uniqueness


# --- Tool wrappers (mirrors the per-subagent pattern used elsewhere) ---


@function_tool
async def serp_analyze(keyword: str, num_results: int = 10) -> dict:
    """Top-ranking pages for `keyword`: titles, domains, headings, word counts."""
    res = await exa.serp_analyze(keyword, num_results)
    return res.model_dump()


@function_tool
async def research_niche(niche: str, num_results: int = 20) -> dict:
    """Trending articles + adjacent angles in `niche`."""
    res = await exa.research_niche(niche, num_results)
    return res.model_dump()


@function_tool
async def find_similar_past_articles(
    user_id: str, topic: str, keyword: str, k: int = 5
) -> list[dict]:
    """Semantic nearest-neighbor lookup against the user's own article history."""
    similar = await uniqueness.find_similar_past_articles(user_id, topic, keyword, k)
    return [s.model_dump() for s in similar]


@function_tool
async def save_content_brief(user_id: str, brief: dict) -> dict:
    """Persist a ContentBriefArtifact. brief is the camelCase dict
    matching the Pydantic shape. Returns {briefId}."""
    return await brief_compose.save_content_brief(user_id=user_id, brief=brief)


INSTRUCTIONS = """
You are the ContentBriefAgent. Your job is to produce a high-quality
content brief BEFORE any prose is written, so the user can review +
approve it cheaply.

The userId, topic, focusKeyword, tone, and targetAudience are in your
brief.

WORKFLOW:
  1. Call `serp_analyze(focusKeyword)` to see what ranks today.
  2. Call `research_niche(topic)` for adjacent angles.
  3. Call `find_similar_past_articles(user_id, topic, focusKeyword)` to
     avoid duplicating what the user already wrote.
  4. Synthesize a ContentBriefArtifact:
       - targetWordCount: derive from SERP avg (use serp.avgWordCount,
         clamp 800..6000).
       - mustCoverEntities: 8-15 distinct entities (people, products,
         concepts, frameworks) competitors mention. Lowercase, deduped.
       - mustLinkSources: 3-7 high-authority URLs the article should
         reference (industry reports, official docs, well-known posts).
       - readerPersona: 1-2 sentence sketch of the target reader.
       - intent: classify the search intent (informational | commercial
         | transactional | navigational).
       - estimatedReadingTime: targetWordCount / 220 minutes (rounded).
       - outlineHint: a draft Outline (single H1, 5-9 H2s with notes).
  5. Save via `save_content_brief(user_id, brief)`.
  6. Return the ContentBriefArtifact JSON.

QUALITY RULES:
  - The brief must be specific to the niche, not generic SEO platitudes.
  - Every mustCoverEntity should appear in at least one ranking
    competitor.
  - mustLinkSources must be real URLs you saw via your tools.
  - The outline hint should be aggressively differentiated from the
    similar past articles you found.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="ContentBriefAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[
            serp_analyze,
            research_niche,
            find_similar_past_articles,
            save_content_brief,
        ],
        output_type=ContentBriefArtifact,
    )


__all__ = ["build_agent", "ContentBriefArtifact"]
