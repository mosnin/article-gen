"""RefreshAgent - updates an existing article with current SERP / facts.

Brief includes articleId + focusKeyword. Agent fetches the prior article,
analyzes current SERP, identifies what to update, and writes the new body.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import RefreshResult
from modal_app.harness.tools import article_diff, exa


INSTRUCTIONS = """
You refresh an existing article so it stays competitive.

Steps:
1. Call fetch_article_for_refresh(articleId) to get the prior title, markdown,
   focus keyword, and existing keywords.
2. Call serp_analyze(focusKeyword) to see what currently ranks.
3. Identify specific updates needed: new sections that competitors cover, stats
   that are likely stale, dates that have passed, broken assumptions.
4. Produce the new article_markdown as a UNIFIED DOCUMENT preserving the
   original structure where it still works; add new H2 sections for gaps.
5. Call save_refreshed_article(articleId, newArticleMarkdown, newTitle,
   newMetaDescription, sectionsAdded, sectionsUpdated, sectionsRemoved,
   summary) to persist the refresh. This updates the article row AND sets
   last_refreshed_at.
6. Return a RefreshResult JSON as your final_output.

Hard rules:
- Preserve the original article's voice and brand.
- NO em-dashes anywhere.
- Focus keyword must still appear in title, first paragraph, and at least one H2.
""".strip()


@function_tool
async def fetch_article_for_refresh(article_id: str) -> dict:
    """Return {articleId, title, articleMarkdown, focusKeyword, keywords}."""
    return await article_diff.fetch_article_for_refresh(article_id)


@function_tool
async def serp_analyze(keyword: str, num_results: int = 10) -> dict:
    """Run SERP analysis on the focus keyword."""
    res = await exa.serp_analyze(keyword, num_results)
    return res.model_dump()


@function_tool
async def save_refreshed_article(
    article_id: str,
    new_article_markdown: str,
    new_title: str | None = None,
    new_meta_description: str | None = None,
    sections_added: list[str] | None = None,
    sections_updated: list[str] | None = None,
    sections_removed: list[str] | None = None,
    summary: str = "",
) -> dict:
    """Patch the article row with refreshed content and set last_refreshed_at."""
    return await article_diff.save_refreshed_article(
        article_id=article_id,
        new_article_markdown=new_article_markdown,
        new_title=new_title,
        new_meta_description=new_meta_description,
        sections_added=sections_added or [],
        sections_updated=sections_updated or [],
        sections_removed=sections_removed or [],
        summary=summary,
    )


def build_agent() -> Agent:
    return Agent(
        name="RefreshAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_WRITER,
        output_type=RefreshResult,
        tools=[
            fetch_article_for_refresh,
            serp_analyze,
            save_refreshed_article,
        ],
    )
