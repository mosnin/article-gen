"""ClusterStrategistAgent - builds pillar + cluster content plans.

Brief includes pillarTopic, pillarKeyword, tone, optional clusterId
(for updates) and optional audience. Agent produces a ClusterPlan with
10-20 subtopics that together cover the pillar authoritatively, then
upserts into the clusters table via the internal API.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import ClusterPlan
from modal_app.harness.tools import cluster_ops, exa, uniqueness


INSTRUCTIONS = """
You design a topic cluster.

Steps:
1. Call serp_analyze(pillarKeyword) to see the top ranking content.
2. Call research_niche(pillarTopic) to find trending angles and gaps.
3. Derive 10-20 cluster subtopics. Each must be:
   - distinct from the pillar (different intent or sub-niche)
   - distinct from each other (use find_similar_past_articles if needed to
     avoid cannibalizing existing user content)
   - assigned an intent (informational/commercial/transactional/navigational)
   - tied back to the pillar via `relationToPillar`
4. Call save_cluster_plan(userId, pillarTopic, pillarKeyword, strategyPlan,
   articleTargetCount) - clusterId optional for update.
5. Return the ClusterPlan JSON as your final_output.

Hard rules:
- Subtopics must NOT be trivial rewordings; each should support a 1500+ word post.
- NO em-dashes anywhere.
- Always include a mix of informational top-of-funnel + commercial mid-funnel.
""".strip()


@function_tool
async def serp_analyze(keyword: str, num_results: int = 10) -> dict:
    """Top-ranking pages for `keyword`: titles, domains, headings, word counts."""
    res = await exa.serp_analyze(keyword, num_results)
    return res.model_dump()


@function_tool
async def research_niche(niche: str, num_results: int = 20) -> dict:
    """Trending articles in `niche`, with gaps and angles (may return empty gaps)."""
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
async def save_cluster_plan(
    user_id: str,
    pillar_topic: str,
    pillar_keyword: str,
    strategy_plan: dict,
    article_target_count: int,
    cluster_id: str | None = None,
) -> dict:
    """Upsert the finalized cluster plan into the clusters table."""
    return await cluster_ops.upsert_cluster_plan(
        user_id=user_id,
        pillar_topic=pillar_topic,
        pillar_keyword=pillar_keyword,
        strategy_plan=strategy_plan,
        article_target_count=article_target_count,
        cluster_id=cluster_id,
    )


def build_agent() -> Agent:
    return Agent(
        name="ClusterStrategistAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        output_type=ClusterPlan,
        tools=[
            serp_analyze,
            research_niche,
            find_similar_past_articles,
            save_cluster_plan,
        ],
    )
