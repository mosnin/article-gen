"""NewsletterDigestAgent — composes a periodic editorial digest.

Pulls the user's recently-published articles within a look-back window,
selects the 3-5 most editorially interesting, and writes a curiosity-gap
subject + preheader + intro + per-article framing into a markdown body.
The output ``NewsletterDigest`` is persisted as ``status='draft'`` so the
user can review/edit/approve in the UI before sending.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import NewsletterDigest
from modal_app.harness.tools import newsletter_compose


# --- Tool wrappers (mirrors the per-subagent pattern used elsewhere) ---


@function_tool
async def list_recent_published_articles(
    user_id: str, period_days: int = 7
) -> dict:
    """List the user's recently-published articles within the look-back window.

    Returns up to 30 rows shaped as
    ``{id, title, slug, focusKeyword, metaDescription, publishedAt, excerpt}``,
    ordered by ``publishedAt`` desc. Use this as your candidate pool.
    """
    return await newsletter_compose.list_recent_published_articles(
        user_id=user_id, period_days=period_days
    )


@function_tool
async def save_newsletter_digest(user_id: str, digest: dict) -> dict:
    """Persist a NewsletterDigest. ``digest`` is the camelCase dict matching
    the Pydantic shape. Returns ``{digestId}``."""
    return await newsletter_compose.save_newsletter_digest(
        user_id=user_id, digest=digest
    )


INSTRUCTIONS = """
You are the NewsletterDigestAgent. Your job is to compose a polished
periodic newsletter digest from the user's recently-published articles.

The userId, niche (topic), and periodDays are in your brief.

WORKFLOW:
  1. Call `list_recent_published_articles(user_id, period_days)` to get
     the candidate pool (up to 30 most-recent published articles).
  2. If the pool is empty, still produce a minimal digest with an intro
     that explains there were no new posts this period and an empty
     bodyMarkdown ("_No new posts this period._"). Do not invent links.
  3. Otherwise, pick the TOP 3-5 by editorial weight:
       - recency (newer wins ties),
       - topic distinctiveness (avoid two posts on the exact same focus
         keyword in one digest — diversify),
       - completeness of metadata (must have title and slug at minimum;
         prefer ones with metaDescription and a meaningful excerpt).
  4. Compose:
       - subject: 50-70 chars, curiosity-gap style (a tease, a number, a
         contrarian framing, or a specific reader benefit). Title-case
         allowed but not required. NO clickbait lies — the tease must
         pay off in the digest body. NO em-dashes or trailing periods.
       - preheader: 110-130 chars, written to be visible alongside the
         subject in inboxes; complement, do NOT repeat, the subject.
       - intro: 2-3 sentences setting context for why these picks
         matter THIS week (or month). Reference the niche.
       - bodyMarkdown: each picked article rendered as
             ### [{title}]({slug-url})
             {1-2 sentence editorial framing}
         where {slug-url} = `/{slug}` (relative — the rendering app
         resolves the absolute URL). Separate entries with a blank line.
         The framing must be EDITORIAL (a reason to click, a "what you'll
         learn", or a fresh angle) — DO NOT just paraphrase the title or
         dump the metaDescription verbatim. Every entry needs framing.
       - articleIds: the IDs of the picks, in the same order as bodyMarkdown.
       - periodStart / periodEnd: ISO dates (YYYY-MM-DD). periodEnd is
         today; periodStart = today minus periodDays.
       - bodyHtml: leave null — the server-side route renders it on read.
  5. Save via `save_newsletter_digest(user_id, digest)`.
  6. Return the NewsletterDigest JSON.

QUALITY RULES:
  - Subject MUST be 50-70 chars; preheader MUST be 110-130 chars. Count
    before returning. If outside the range, rewrite.
  - Do NOT just dump titles — every body entry needs a real editorial
    framing sentence (or two).
  - Do NOT include articles you did not actually receive from the tool.
  - Do NOT fabricate slugs — use the slug field exactly.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="NewsletterDigestAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[
            list_recent_published_articles,
            save_newsletter_digest,
        ],
        output_type=NewsletterDigest,
    )


__all__ = ["build_agent", "NewsletterDigest"]
