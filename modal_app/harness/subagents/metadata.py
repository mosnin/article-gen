"""MetadataAgent - title, slug, meta description, keywords, JSON-LD schema.

Input brief: article markdown, topic, focus keyword, tone.

Output: Metadata (output_type). The JSON-LD schema is generated as a
side-channel string via generate_schema_json and attached by the
orchestrator to the save_article payload; if the agent returns it inline,
the orchestrator extracts it from the surrounding brief flow.
"""
from __future__ import annotations

from agents import Agent, function_tool
from pydantic import BaseModel, ConfigDict

from modal_app import config
from modal_app.harness.models import FinalArticle, Metadata
from modal_app.harness.tools import openai_tools


class MetadataWithSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")
    metadata: Metadata
    schemaJson: str | None = None


@function_tool
async def generate_metadata_json(
    topic: str, keyword: str, article_md: str, tone: str
) -> dict:
    """Produce title / slug / meta description / keywords for the article."""
    result = await openai_tools.generate_metadata_json(topic, keyword, article_md, tone)
    return result.model_dump()


@function_tool
async def generate_schema_json(article: dict) -> str:
    """Return JSON-LD (Article + FAQPage @graph) as a pretty-printed string."""
    final = FinalArticle.model_validate(article)
    return await openai_tools.generate_schema_json(final)


INSTRUCTIONS = """
You are MetadataAgent.

Given the article markdown, focus keyword, topic, and tone, produce
publication-ready metadata:

  - title: 50-60 chars, must contain the focus keyword near the front.
  - slug: kebab-case, lowercase, no stopwords like "the" or "a" unless
    semantically necessary.
  - metaDescription: 150-160 chars, enticing, includes the focus keyword.
  - Never use em-dashes or en-dashes in any field.
  - focusKeyword: echo the brief's focus keyword.
  - keywords: 6-10 related keyphrases for on-page SEO.

Call `generate_metadata_json(topic, keyword, article_md, tone)` to draft
these, then return the Metadata JSON as your final_output.

Return a MetadataWithSchema JSON containing `metadata` (the Metadata
object) and `schemaJson` (the string from generate_schema_json, or null
if not requested).
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="MetadataAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[generate_metadata_json, generate_schema_json],
        output_type=MetadataWithSchema,
    )
