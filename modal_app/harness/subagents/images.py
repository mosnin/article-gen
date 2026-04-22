"""ImageAgent: generate image prompts, then DALL-E + Supabase upload.

Input brief: article title, focus keyword, article markdown, imageCount
(default from config.DEFAULT_IMAGE_COUNT), user_id, article_id.

Output: ImagesResult (prompts + images).
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import ImagesResult
from modal_app.harness.tools import dalle, openai_tools


@function_tool
async def generate_image_prompts(
    title: str, keyword: str, article_md: str, count: int = 4
) -> list[dict]:
    """Produce `count` DALL-E prompts (hero + inline variants) with alt text."""
    prompts = await openai_tools.generate_image_prompts(title, keyword, article_md, count)
    return [p.model_dump() for p in prompts]


@function_tool
async def generate_image(
    user_id: str, article_id: str, prompt: str, alt_text: str
) -> dict:
    """Render one DALL-E-3 image, upload to Supabase, return storagePath + publicUrl."""
    img = await dalle.generate_image(user_id, article_id, prompt, alt_text)
    return img.model_dump()


INSTRUCTIONS = """
You are ImageAgent.

Generate a set of images for the article.

Workflow:

  1. Call `generate_image_prompts(title, keyword, article_md, count)`.
     `count` comes from the brief (default {default_image_count}).
  2. For each prompt in the returned list, call
     `generate_image(user_id, article_id, prompt.prompt, prompt.altText)`.
     Continue even if individual calls return `success: false`; those
     entries will land in the output with success=False.
  3. Return an ImagesResult with:
       - prompts: the original prompt list
       - images: the GeneratedImage results

Do NOT mutate the altText content; keep the focus keyword references
intact.
""".strip().format(default_image_count=config.DEFAULT_IMAGE_COUNT)


def build_agent() -> Agent:
    return Agent(
        name="ImageAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[generate_image_prompts, generate_image],
        output_type=ImagesResult,
    )
