"""SocialSnippetAgent - produces per-platform repurposed snippets
from a published article."""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import SocialSnippetSet
from modal_app.harness.tools import social_format
from modal_app.harness.tools.article_diff import fetch_article_for_refresh


INSTRUCTIONS = """
You repurpose a published article into platform-native snippets.

Steps:
1. Call fetch_article(articleId) to get title + markdown.
2. For each platform in the brief's socialPlatforms (default: twitter +
   linkedin), call compose_snippet(platform, variant, ...) to produce
   1-3 variants:
     - twitter: single-tweet hook AND a 5-8 tweet thread
     - linkedin: a 150-250 word post with 2-3 short paragraphs and a CTA
     - instagram: a caption with hook + body + 5-10 hashtags
     - facebook: a 50-120 word post with a link CTA
     - newsletter: a 200-400 word digest snippet with a headline
3. Do not use em-dashes. Use commas or periods.
4. Call save_snippets(userId, articleId, snippets) once at the end -
   snippets is a list of {platform, variant, body, hashtags, imageUrl}.
5. Return a SocialSnippetSet JSON as final_output.
""".strip()


@function_tool
async def fetch_article(article_id: str) -> dict:
    """Fetch the article's title + markdown for repurposing."""
    return await fetch_article_for_refresh(article_id)


@function_tool
async def compose_snippet(
    platform: str,
    variant: str,
    article_title: str,
    article_markdown: str,
) -> dict:
    """Ask the model for a single platform-specific snippet. Returns
    {platform, variant, body, hashtags}."""
    return await social_format.compose_snippet(
        platform=platform,
        variant=variant,
        article_title=article_title,
        article_markdown=article_markdown,
    )


@function_tool
async def save_snippets(
    user_id: str, article_id: str, snippets: list[dict]
) -> dict:
    """Persist the produced snippets via /api/internal/save-social-snippets."""
    return await social_format.save_snippets(
        user_id=user_id, article_id=article_id, snippets=snippets
    )


def build_agent() -> Agent:
    return Agent(
        name="SocialSnippetAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        output_type=SocialSnippetSet,
        tools=[fetch_article, compose_snippet, save_snippets],
    )
