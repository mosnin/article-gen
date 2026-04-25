"""Competitor monitoring tools — RSS/sitemap fetch + classification + persistence."""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def list_competitors(user_id: str) -> dict:
    """Get the user's active competitor list. Returns
    { competitors: [{id, domain, feed_url, sitemap_url, label, last_checked_at}] }."""
    return await post_internal("/list-competitors", {"userId": user_id})


@function_tool
async def fetch_competitor_feed(
    competitor_id: str, since_days: int = 14
) -> dict:
    """Fetch a competitor's RSS or sitemap (whichever is set). Returns
    { entries: [{url, title, publishedAt}] } limited to articles published
    in the last `since_days` days."""
    return await post_internal(
        "/fetch-competitor-feed",
        {"competitorId": competitor_id, "sinceDays": since_days},
    )


@function_tool
async def filter_already_seen(user_id: str, urls: list[str]) -> dict:
    """Given a list of URLs, return { newUrls: [...], seenUrls: [...] }
    by joining against competitor_articles for this user."""
    return await post_internal(
        "/filter-seen-competitor-urls",
        {"userId": user_id, "urls": urls},
    )


@function_tool
async def save_competitor_articles(
    user_id: str, articles: list[dict]
) -> dict:
    """Persist discovered competitor articles. articles: list of
    {competitorId, url, title, publishedAt?, classification, rebuttalTopic,
     rebuttalFocusKeyword, rebuttalAngle}.
    Returns {ids: [str]}."""
    return await post_internal(
        "/save-competitor-articles",
        {"userId": user_id, "runId": get_run_id(), "articles": articles},
    )
