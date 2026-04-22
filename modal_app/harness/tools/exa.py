"""SERP / niche research tools.

Route through /api/internal/* which calls the existing Exa-backed helpers on
Next.js.
"""

from modal_app.harness.models import NicheResearch, SerpAnalysis
from modal_app.harness.tools.http import post_internal


async def serp_analyze(keyword: str, num_results: int = 10) -> SerpAnalysis:
    data = await post_internal(
        "/serp-analyze", {"keyword": keyword, "numResults": num_results}
    )
    return SerpAnalysis.model_validate(data)


async def research_niche(niche: str, num_results: int = 20) -> NicheResearch:
    data = await post_internal(
        "/research-niche",
        {"niche": niche, "options": {"numResults": num_results}},
    )
    return NicheResearch.model_validate(data)
