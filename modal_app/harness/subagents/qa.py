"""QAAgent: scores a draft article on keyword density, E-E-A-T,
readability. Flags em-dash violations explicitly.

Input brief: article markdown, focus keyword.

Output: QualityScore.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import QualityScore
from modal_app.harness.tools import openai_tools


@function_tool
async def score_article(article_md: str, focus_keyword: str) -> dict:
    """Compute quality score: density, E-E-A-T, readability, notes."""
    result = await openai_tools.score_article(article_md, focus_keyword)
    return result.model_dump()


INSTRUCTIONS = """
You are QAAgent.

Score a draft article.

Workflow:

  1. Call `score_article(article_md, focus_keyword)`.
  2. If the returned notes contain em-dash or en-dash occurrences, keep
     them in the notes list (do NOT remove) so the orchestrator knows
     to request a rewrite.
  3. Return the QualityScore JSON as final_output.

Do NOT modify the article itself.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="QAAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[score_article],
        output_type=QualityScore,
    )
