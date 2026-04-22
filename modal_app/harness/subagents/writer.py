"""WriterAgent - writes the full article body.

Input brief: Outline JSON, tone, audience, focusKeyword,
recommendedWordCount, user_id (for interlinking), and optional
research context.

Output: unstructured markdown STRING (no output_type). The orchestrator
reads it as result.final_output and includes it in the save_article
payload.

Implementation note: the first iteration writes the article
section-by-section sequentially for deterministic behavior. A per-section
fan-out using SubAgentPool.invoke_many is a planned follow-up.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import SectionContext
from modal_app.harness.tools import openai_tools


@function_tool
async def write_section(heading: str, notes: str, context: dict) -> str:
    """Write one article section in markdown for the given heading. NO em-dashes."""
    ctx = SectionContext.model_validate(context)
    return await openai_tools.write_section(heading, notes, ctx)


@function_tool
async def interlink_suggest(user_id: str, article_md: str) -> list[dict]:
    """Suggest internal links into the user's own prior articles (up to 5, scored)."""
    result = await openai_tools.interlink_suggest(user_id, article_md)
    return [r.model_dump() for r in result]


INSTRUCTIONS = """
You are WriterAgent.

You compose a single publication-ready article body in markdown, using
the Outline in the brief as your scaffold.

Strict rules:

  - Start with a single H1 (the Outline's title). Exactly one H1 in the document.
  - Every section from the Outline MUST appear in order.
  - NO em-dashes anywhere. Use commas or periods. NO en-dashes either.
  - Keep focus keyword density between roughly 0.8% and 1.5% of total words.
  - Focus keyword MUST appear in the H1, the first paragraph, and at
    least one H2.
  - Target the SerpAnalysis recommendedWordCount from the brief
    (clamp to 500-8000 words).
  - Reflect E-E-A-T: concrete examples, expert framing, trustworthy
    sources by reference where appropriate.
  - Prefer short sentences. Use active voice.

Workflow:

  1. Write each section individually via `write_section(heading, notes, context)`.
     Thread `previousSections` so the writer maintains tonal continuity.
  2. After all sections are drafted, call `interlink_suggest(user_id, full_draft)`
     and integrate any high-confidence suggestions (score >= 0.6) as inline
     markdown links in the final draft.
  3. Concatenate into one markdown string and return it as your
     final_output.

Return the finished article body as plain markdown (no JSON wrapper).
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="WriterAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_WRITER,
        tools=[write_section, interlink_suggest],
        # no output_type - writer emits raw markdown
    )
