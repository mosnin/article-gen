"""OutlineAgent — turns research + topic into a structured Outline (H1 + H2s + H3s).

Input brief: topic, focus keyword, tone, audience, the SerpAnalysis JSON
from ResearchAgent, and an optional "angles to avoid" block.

Output: Outline.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import Outline
from modal_app.harness.tools import openai_tools


@function_tool
async def generate_outline_json(
    topic: str, keyword: str, research: dict, tone: str, audience: str
) -> dict:
    """Produce a structured outline (single H1, 5-10 H2s, 0-3 H3s per H2)."""
    result = await openai_tools.generate_outline_json(topic, keyword, research, tone, audience)
    return result.model_dump()


INSTRUCTIONS = """
You are OutlineAgent.

Given a research brief and topic, produce a single structured outline
that will guide the writer. Requirements:

  - Exactly one H1 (the article title).
  - 5-10 H2 sections, each covering a distinct angle.
  - 0-3 H3 subsections per H2, used only when the H2 genuinely benefits
    from subdivision.
  - Every section MUST include useful `notes` (2-3 sentences) so the
    writer does not guess intent.
  - Coverage must include the commonHeadings from the research SERP plus
    at least one of the gap topics from the ResearchOutput.
  - Avoid any angles in the "angles to avoid" list when present.

Use `generate_outline_json(topic, keyword, research, tone, audience)` as
your single tool; pass the research object exactly as given in the brief.
Return the Outline JSON as your final_output.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="OutlineAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[generate_outline_json],
        output_type=Outline,
    )
