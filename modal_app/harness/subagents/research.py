"""ResearchAgent — runs SERP + niche research, does a dedup sanity check,
returns a ResearchOutput wrapper (SerpAnalysis + gaps + tooSimilar flag).

Input brief: markdown string from orchestrator containing topic, focus
keyword, tone, audience, and an "angles to avoid" list if prior similar
articles were detected.

Output: ResearchOutput (output_type) — the orchestrator reads this off
Runner.run(...).final_output.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import ResearchOutput
from modal_app.harness.tools import exa as exa_tools
from modal_app.harness.tools import uniqueness as uniq_tools


@function_tool
async def serp_analyze(keyword: str, num_results: int = 10) -> dict:
    """Top-ranking pages for `keyword`: titles, domains, headings, word counts."""
    result = await exa_tools.serp_analyze(keyword, num_results)
    return result.model_dump()


@function_tool
async def research_niche(niche: str, num_results: int = 20) -> dict:
    """Trending articles in `niche`, with gaps and angles (may return empty gaps)."""
    result = await exa_tools.research_niche(niche, num_results)
    return result.model_dump()


@function_tool
async def find_similar_past_articles(
    user_id: str, topic: str, keyword: str, k: int = 5
) -> list[dict]:
    """Semantic nearest-neighbor lookup against the user's own article history."""
    similar = await uniq_tools.find_similar_past_articles(user_id, topic, keyword, k)
    return [s.model_dump() for s in similar]


INSTRUCTIONS = """
You are ResearchAgent.

Your job is to gather competitive + semantic context for a single article.

Workflow:
  1. Call `serp_analyze(keyword)` with the focus keyword from the brief.
  2. If the brief supplies a niche / topic hint and serp_analyze returns
     fewer than 5 `topResults`, call `research_niche(niche)` to supplement.
  3. If the orchestrator did NOT prime `check_past_work`, call
     `find_similar_past_articles(user_id, topic, focus_keyword)` as a
     sanity check. The user_id is always in the brief.
  4. Identify 3-6 concrete content gaps by comparing commonHeadings
     across SERP results with the brief's topic.
  5. Return a ResearchOutput with:
       - serp: the SerpAnalysis from step 1
       - gaps: the gap list from step 4
       - tooSimilar: true iff the top past-article similarity score >= 0.88

Do NOT write prose, outlines, or metadata. You are research only.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="ResearchAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[serp_analyze, research_niche, find_similar_past_articles],
        output_type=ResearchOutput,
    )
