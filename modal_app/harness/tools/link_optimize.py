"""InternalLinkOptimizer tools — corpus scan + link suggestion persistence."""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def list_user_articles_for_linking(user_id: str, limit: int = 200) -> dict:
    """Pull the user's recent published articles. Returns
    { articles: [{id, title, slug, focusKeyword, keywords, excerpt}] }."""
    return await post_internal(
        "/list-articles-for-linking",
        {"userId": user_id, "limit": limit},
    )


@function_tool
async def fetch_article_body(user_id: str, article_id: str) -> dict:
    """Get the full markdown of one article so the agent can scan for anchor candidates.
    Returns { articleId, title, articleMarkdown, focusKeyword }."""
    return await post_internal(
        "/get-article",
        {"userId": user_id, "articleId": article_id},
    )


@function_tool
async def save_link_suggestions(user_id: str, suggestions: list[dict]) -> dict:
    """Persist link suggestions. Each: {sourceArticleId, targetArticleId,
    anchorText, contextSnippet, confidence}. Returns {insertedCount}."""
    return await post_internal(
        "/save-link-suggestions",
        {"userId": user_id, "runId": get_run_id(), "suggestions": suggestions},
    )
