"""TopicResearcherAgent — discovers candidate articles in the user's niche.

Hard rules enforced at three layers:
  1. System prompt below.
  2. Output type: TopicProposalSet (Pydantic, with field validators).
  3. Programmatic post-filter: modal_app.harness.topic_filter.filter_on_topic.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import TopicProposalSet
from modal_app.harness.tools import uniqueness as uniq_tools
from modal_app.harness.tools.topic_proposal_store import save_topic_proposals
from modal_app.harness.tools.web_research import (
    find_recent_news,
    validate_topic_on_niche,
    web_search,
)


@function_tool
async def find_similar_past_articles(
    user_id: str, topic: str, keyword: str, k: int = 5
) -> list[dict]:
    """Semantic nearest-neighbor lookup against the user's own article history."""
    similar = await uniq_tools.find_similar_past_articles(user_id, topic, keyword, k)
    return [s.model_dump() for s in similar]


INSTRUCTIONS = """
You are the TopicResearcher. Your job is to propose 5-15 article ideas
for the user's declared niche, based on real signals from the web.

The user_id, niche, and any "angles to avoid" list will be in your brief.

ABSOLUTE RULES - never violate:
  1. STAY IN THE NICHE. The niche field on every proposal MUST exactly
     equal the input niche string. If a search result is interesting
     but off-niche, drop it. A reader of a niche-focused publication
     should not be surprised by your titles.
  2. EVIDENCE. Every proposal MUST cite at least 3 evidence URLs (news,
     competitor article, forum thread, official announcement, etc.) in
     `evidenceUrls`. URLs must be real http(s) links you saw via your
     tools - do not invent URLs.
  3. FRESHNESS. Set `freshnessSignal` to one of:
       - news_30d           : news/announcement in the last 30 days
       - trending_search    : visible spike in SERP / trending topics
       - competitor_recent  : competitor published on this in last 60 days
       - seasonal           : recurring seasonal angle
       - evergreen_gap      : timeless gap (use sparingly)
     Match the signal to your evidence.
  4. DEDUP. BEFORE finalizing, call `find_similar_past_articles` for
     each candidate keyword. If similarity >= {dedup_threshold:.2f}, drop
     the candidate.
  5. NO INVENTION. Do not propose a topic you cannot tie to a concrete
     piece of evidence. "I have a hunch" is not enough.
  6. RELEVANCE SCORE. Set `relevanceScore` (0..1) based on niche fit
     and audience alignment. Anything below 0.7 must be dropped before
     finalizing.

Workflow:
  1. Brainstorm 20-30 niche-bounded queries. Use `web_search` and
     `find_recent_news` to gather hits.
  2. Cluster hits into 10-20 candidate angles.
  3. For each candidate, call `validate_topic_on_niche` and
     `find_similar_past_articles` as a guardrail check.
  4. Drop candidates that fail validation, score < 0.7, or duplicate
     past work.
  5. Populate `rejected[]` with the dropped ones plus a one-line reason
     each (transparency).
  6. Call `save_topic_proposals(user_id, niche, proposals)` with the
     surviving proposals.
  7. Return a TopicProposalSet JSON.
""".strip().format(dedup_threshold=config.DEDUP_THRESHOLD)


def build_agent() -> Agent:
    return Agent(
        name="TopicResearcherAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[
            web_search,
            find_recent_news,
            validate_topic_on_niche,
            find_similar_past_articles,
            save_topic_proposals,
        ],
        output_type=TopicProposalSet,
    )
