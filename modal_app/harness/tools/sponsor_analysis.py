"""SponsorshipFit tools — corpus + GSC traffic fetch and fit persistence.

`list_articles_with_traffic` POSTs `/api/internal/list-articles-with-traffic`
to pull each published article along with a best-effort 30d GSC click
count. The route returns ``gscConnected: false`` (and ``monthlyClicks: null``
on each row) when the user has not connected Search Console — the agent
should degrade gracefully in that case.

`save_sponsor_fits` persists the agent's `SponsorFit[]` via
`/api/internal/save-sponsor-fits`.
"""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def list_articles_with_traffic(user_id: str, limit: int = 100) -> dict:
    """Pull the user's published articles plus a best-effort monthly GSC
    click count for each one.

    The route caps ``limit`` at 200 server-side. Each article row carries
    its `id`, `title`, `slug`, `focusKeyword`, `keywords`, `topic`, and a
    `monthlyClicks` integer (last 30 days, page-level). When GSC is not
    connected the route still returns the article list but every
    `monthlyClicks` is ``null`` and `gscConnected` is ``false`` so the
    agent can surface that gracefully (it should still emit fits but
    cannot compute the traffic component reliably).

    Returns:
      {
        "gscConnected": bool,
        "articles": [
          {
            "id", "title", "slug", "focusKeyword",
            "keywords": [str, ...],
            "topic": str,
            "monthlyClicks": int | None
          },
          ...
        ]
      }
    """
    return await post_internal(
        "/list-articles-with-traffic",
        {"userId": user_id, "limit": limit},
    )


@function_tool
async def save_sponsor_fits(user_id: str, fits: list[dict]) -> dict:
    """Persist the diagnosed SponsorFits.

    Each fit dict matches the SponsorFit Pydantic shape:
      {articleId, fitScore, monthlyTrafficEstimate, nicheTightness,
       evergreenScore, suggestedSponsorArchetypes, rationale}

    Returns ``{"insertedCount": int}``.
    """
    return await post_internal(
        "/save-sponsor-fits",
        {"userId": user_id, "runId": get_run_id(), "fits": fits},
    )
