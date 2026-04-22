"""WriterAgent - writes the full article body.

Input brief: Outline JSON, tone, audience, focusKeyword,
recommendedWordCount, user_id (for interlinking), and optional
research context.

Output: unstructured markdown STRING (no output_type). The orchestrator
reads it as result.final_output and includes it in the save_article
payload.

Implementation note: for long articles the LLM should call
`write_all_sections` once to fan out H2 sections in parallel
(asyncio.gather with a concurrency cap). Short articles can still use
the sequential `write_section` loop.
"""
from __future__ import annotations

import asyncio
import json

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import Outline, SectionContext
from modal_app.harness.tools import openai_tools

_MAX_CONCURRENT_SECTIONS = 3


@function_tool
async def write_section(heading: str, notes: str, context: dict) -> str:
    """Write one article section in markdown for the given heading. NO em-dashes."""
    ctx = SectionContext.model_validate(context)
    return await openai_tools.write_section(heading, notes, ctx)


@function_tool
async def write_all_sections(outline_json: str, context_json: str) -> str:
    """Write every H2 section of the outline in parallel and return joined markdown.

    Use this for outlines with 3+ H2 sections to get 2-4x throughput. Caps
    concurrency at 3 in-flight OpenAI calls. Preserves outline order in the
    output. Failed sections fall back to a placeholder (no em-dashes).
    """
    outline = Outline.model_validate_json(outline_json)
    base_ctx = SectionContext.model_validate(json.loads(context_json))

    h2_sections = [s for s in outline.sections if s.level == 2]

    # Build a per-section context: reuse the base but clear previousSections
    # and ensure the full outline is threaded through.
    per_section_ctx = base_ctx.model_copy(
        update={"outline": outline, "previousSections": []}
    )

    semaphore = asyncio.Semaphore(_MAX_CONCURRENT_SECTIONS)

    async def _bounded_write(heading: str, notes: str) -> str:
        async with semaphore:
            return await openai_tools.write_section(heading, notes, per_section_ctx)

    wrapped = [_bounded_write(s.heading, s.notes) for s in h2_sections]
    results = await asyncio.gather(*wrapped, return_exceptions=True)

    pieces: list[str] = []
    for section, outcome in zip(h2_sections, results, strict=True):
        if isinstance(outcome, BaseException):
            pieces.append(
                f"## {section.heading}\n\n"
                f"_section generation failed: {outcome!s}_\n"
            )
        else:
            pieces.append(outcome)

    return "\n\n".join(pieces)


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

  1. Choose a drafting strategy based on outline length:
     - For articles with 3+ H2 sections, prefer calling
       `write_all_sections(outline_json, context_json)` ONCE with the full
       outline JSON. This fans out section writes in parallel for much
       higher throughput.
     - For short articles (1-2 sections), call
       `write_section(heading, notes, context)` iteratively so you can
       thread `previousSections` for tonal continuity.
  2. After all sections are drafted, call `interlink_suggest(user_id, full_draft)`
     and integrate any high-confidence suggestions (score >= 0.6) as inline
     markdown links in the final draft.
  3. Prepend the H1 title, concatenate into one markdown string, and
     return it as your final_output.

Return the finished article body as plain markdown (no JSON wrapper).
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="WriterAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_WRITER,
        tools=[write_section, write_all_sections, interlink_suggest],
        # no output_type - writer emits raw markdown
    )
