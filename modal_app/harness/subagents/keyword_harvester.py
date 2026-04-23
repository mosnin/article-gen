"""KeywordHarvesterAgent — harvests new keyword ideas for the user.

Sources: GSC query inventory, SERP gap analysis on adjacent topics,
competitor niche scan.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import KeywordCandidate, KeywordCandidateSet
from modal_app.harness.tools import exa, gsc_queries, keyword_store


INSTRUCTIONS = """
You harvest keyword candidates for the user's niche.

Steps:
1. If gscSiteUrl is present and the user has GSC connected, call
   fetch_gsc_queries(userId) and use rows with 2+ impressions and
   position > 3 as a signal of untapped demand.
2. Call research_niche(niche) to surface trending angles.
3. Call serp_analyze(focusKeyword) to find adjacent-topic gaps.
4. Build 20-50 KeywordCandidate objects. Each must have:
   - keyword (unique)
   - source: 'gsc_queries' | 'serp_gap' | 'competitor' | 'manual'
   - intent: informational | commercial | transactional | navigational
   - estimatedVolume: integer (null acceptable)
5. Call save_candidates(userId, candidates). The endpoint dedupes by
   (user_id, lower(keyword)) so you can freely submit duplicates of prior
   harvests — skipped ones come back in skippedCount.
6. Return a KeywordCandidateSet JSON as final_output.

Quality bar:
- No branded keywords or direct competitor product names.
- Prefer long-tail (3+ words) over head terms for new sites.
- Diversify across intents — do not return all informational.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="KeywordHarvesterAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        output_type=KeywordCandidateSet,
        tools=[
            fetch_gsc_queries,
            research_niche,
            serp_analyze,
            save_candidates,
        ],
    )


@function_tool
async def fetch_gsc_queries(user_id: str, limit: int = 100, days: int = 28) -> dict:
    """Fetch the user's GSC query inventory for untapped-demand signal."""
    return await gsc_queries.fetch_queries(user_id=user_id, limit=limit, days=days)


@function_tool
async def research_niche(niche: str, num_results: int = 20) -> dict:
    """Trending articles + gaps for the user's niche."""
    res = await exa.research_niche(niche, num_results)
    return res.model_dump()


@function_tool
async def serp_analyze(keyword: str, num_results: int = 10) -> dict:
    """SERP snapshot for a seed keyword — used to mine adjacent gaps."""
    res = await exa.serp_analyze(keyword, num_results)
    return res.model_dump()


@function_tool
async def save_candidates(user_id: str, candidates: list[dict]) -> dict:
    """Persist harvested candidates. Endpoint dedupes by (user_id, lower(keyword))."""
    return await keyword_store.upsert(user_id=user_id, candidates=candidates)


__all__ = ["build_agent", "KeywordCandidate", "KeywordCandidateSet"]
