"""Article fetch + refresh-save tools. Route through /api/internal/*.

The service-role Supabase key stays on Vercel.
"""
from __future__ import annotations

from datetime import datetime, timezone

from modal_app.harness.tools.http import post_internal


async def fetch_article_for_refresh(article_id: str) -> dict:
    """Fetch a single article for the RefreshAgent.

    Calls POST /api/internal/get-article with {articleId}. Raises if the
    endpoint is unreachable so the LLM surfaces a clear error rather than
    silently guessing at article contents.
    """
    try:
        return await post_internal("/get-article", {"articleId": article_id})
    except Exception as exc:
        raise RuntimeError(
            f"internal route /api/internal/get-article not available; "
            f"cannot fetch article {article_id} for refresh"
        ) from exc


async def save_refreshed_article(
    *,
    article_id: str,
    new_article_markdown: str,
    new_title: str | None,
    new_meta_description: str | None,
    sections_added: list[str],
    sections_updated: list[str],
    sections_removed: list[str],
    summary: str,
) -> dict:
    """Patch the article row with refreshed content.

    Sets ``article_markdown``, ``last_refreshed_at`` (now, UTC), and flips
    ``lifecycle`` to ``published``. Optionally updates ``title`` and
    ``meta_description`` if the agent chose new values.
    """
    patch: dict = {
        "article_markdown": new_article_markdown,
        "last_refreshed_at": datetime.now(timezone.utc).isoformat(),
        "lifecycle": "published",
    }
    if new_title:
        patch["title"] = new_title
    if new_meta_description:
        patch["meta_description"] = new_meta_description

    await post_internal(
        "/update-article",
        {"articleId": article_id, "patch": patch},
    )
    return {
        "articleId": article_id,
        "newArticleMarkdown": new_article_markdown,
        "titleChanged": bool(new_title),
        "newTitle": new_title,
        "newMetaDescription": new_meta_description,
        "sectionsAdded": sections_added,
        "sectionsUpdated": sections_updated,
        "sectionsRemoved": sections_removed,
        "summary": summary,
    }
