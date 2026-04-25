"""NewsletterDigest tools — candidate retrieval + persistence helpers.

The agent asks the internal API for the user's recently-published articles
within a configurable look-back window, then persists the assembled
``NewsletterDigest`` (with ``status='draft'``) back via a second internal
endpoint.
"""
from __future__ import annotations

from modal_app.harness.tools.http import get_run_id, post_internal


async def list_recent_published_articles(
    user_id: str, period_days: int = 7
) -> dict:
    """Fetch published-article candidates for digest inclusion.

    POSTs to ``/list-recent-published-articles`` which returns up to 30
    rows ordered by ``published_at`` desc. Each row has the shape
    ``{id, title, slug, focusKeyword, metaDescription, publishedAt, excerpt}``.

    Returns ``{"articles": [...]}``.
    """
    days = max(1, min(365, int(period_days)))
    return await post_internal(
        "/list-recent-published-articles",
        {"userId": user_id, "periodDays": days},
    )


async def save_newsletter_digest(user_id: str, digest: dict) -> dict:
    """Persist a NewsletterDigest as ``status='draft'``.

    ``digest`` is the camelCase dict matching the Pydantic ``NewsletterDigest``
    shape (subject, preheader, intro, articleIds, bodyMarkdown, bodyHtml,
    periodStart, periodEnd). Returns ``{"digestId": "..."}``.
    """
    return await post_internal(
        "/save-newsletter-digest",
        {"userId": user_id, "runId": get_run_id(), "digest": digest},
    )
