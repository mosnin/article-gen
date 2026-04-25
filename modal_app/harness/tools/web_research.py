"""Web research tools for TopicResearcher (broad-topic discovery)."""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import post_internal


@function_tool
async def web_search(niche: str, query: str, num_results: int = 10) -> dict:
    """Search the web for content matching a niche-bound query.

    Returns: { results: [{title, url, domain, snippet, publishedDate?}] }
    Strict: results MUST be filtered to the user's declared niche on the
    Next.js side. Do not return off-niche hits.
    """
    return await post_internal(
        "/web-search",
        {"niche": niche, "query": query, "numResults": num_results},
    )


@function_tool
async def find_recent_news(niche: str, days: int = 30, num_results: int = 15) -> dict:
    """Find news/articles in the user's niche published in the last `days`.

    Returns: { results: [{title, url, domain, snippet, publishedDate}] }
    """
    return await post_internal(
        "/find-recent-news",
        {"niche": niche, "days": days, "numResults": num_results},
    )


@function_tool
async def validate_topic_on_niche(
    niche: str, title: str, focus_keyword: str, evidence_urls: list[str]
) -> dict:
    """Programmatic guardrail. Returns {valid: bool, reasons: [str]}.

    Server-side rule: niche term must appear in title OR focus_keyword,
    evidence_urls must be >= 3 and all http(s).
    """
    return await post_internal(
        "/validate-topic",
        {
            "niche": niche,
            "title": title,
            "focusKeyword": focus_keyword,
            "evidenceUrls": evidence_urls,
        },
    )
