"""SeasonalCalendarAgent — plots ideal publish dates for seasonal/recurring content.

Combines three signals:
  1. The user's own publishing history (annual roundups, recurring series).
  2. General industry-agnostic calendar events (Black Friday, year-end,
     conference seasons, major holidays).
  3. Niche-specific seasonal cues discovered via Exa research + web search.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import NicheResearch, SeasonalCalendarReport
from modal_app.harness.tools import exa
from modal_app.harness.tools.seasonal_planner import (
    list_user_published_articles,
    save_seasonal_recommendations,
)
from modal_app.harness.tools.web_research import web_search


# --- Tool wrappers (mirrors per-subagent pattern) ---


@function_tool
async def research_niche(niche: str, num_results: int = 20) -> dict:
    """Trending articles + adjacent angles in `niche` (Exa-backed)."""
    res: NicheResearch = await exa.research_niche(niche, num_results)
    return res.model_dump()


INSTRUCTIONS = """
You are the SeasonalCalendarAgent. Your job is to plot ideal publish
dates for seasonal, recurring, and time-sensitive content across the
next 90 days for this user's niche.

The userId and niche are in your brief.

WORKFLOW:
  1. Call `list_user_published_articles(user_id, limit=200)` to pull
     the user's article history. Scan the `topic` + `focusKeyword` +
     `createdAt` fields for RECURRING patterns:
       - Same topic published annually around the same month
         (e.g. "year-end roundup" every December).
       - Quarterly series (e.g. "Q1 trends report").
       - Monthly cadences tied to a calendar event.
     If a recurring pattern is found, propose the next instance with
     `signalType="recurring_topic"`.
  2. Layer in GENERAL industry-agnostic seasonal events that fall in
     the next 90 days. Examples (only include if they actually fall in
     window): Black Friday / Cyber Monday, year-end retrospectives,
     New Year planning, tax-season content (US + EU), summer-holiday
     slowdown angles, back-to-school. Use `signalType="holiday"` or
     `"seasonal_event"` as appropriate.
  3. Call `research_niche(niche)` and `web_search(niche, query)` with
     queries like "<niche> conference 2026", "<niche> seasonal
     trends", "<niche> annual report", "<niche> awards season" to
     surface NICHE-SPECIFIC cues (industry conferences, product-launch
     windows, regulatory deadlines). For these use
     `signalType="industry_cycle"` or `"seasonal_event"`.
  4. For evergreen content that has a strong seasonal lift but no
     hard deadline (e.g. "best running shoes" peaks in spring), use
     `signalType="evergreen_seasonal"`.
  5. Synthesize 5-15 SeasonalRecommendation entries. For each:
       - `topic`: a concrete 50-100-char article title (NOT a generic
         category — actionable enough to brief a writer with).
       - `focusKeyword`: 2-5 word target keyword.
       - `rationale`: 1-3 sentences explaining WHY this date and HOW
         it ties to the signal (cite the user-history pattern, the
         specific event, or the niche cue you found).
       - `signalType`: one of seasonal_event | recurring_topic |
         holiday | industry_cycle | evergreen_seasonal.
       - `recommendedPublishAt`: ISO-8601 date/datetime, MUST fall
         within the next 90 days from today. Plan publish dates
         7-21 days BEFORE the underlying event so the article has
         time to rank (e.g. for Black Friday Nov 28, recommend
         publishing Nov 7-14).
  6. Save via `save_seasonal_recommendations(user_id, recommendations)`.
  7. Return a SeasonalCalendarReport JSON with `recommendations`,
     `horizonDays=90`, and a 1-2 sentence overall `rationale`.

QUALITY RULES:
  - Stay strictly in the user's niche. Do not propose generic SEO
    advice; every recommendation must be specific to the niche.
  - Do not duplicate topics the user has already published in the
    last 6 months unless it is a recurring annual instance.
  - Spread `recommendedPublishAt` dates across the 90-day window —
    avoid clustering everything in one week.
  - Prefer 5-15 high-signal entries over padding. If you cannot
    find at least 5 strong signals, still return what you have.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="SeasonalCalendarAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[
            list_user_published_articles,
            research_niche,
            web_search,
            save_seasonal_recommendations,
        ],
        output_type=SeasonalCalendarReport,
    )


__all__ = ["build_agent", "SeasonalCalendarReport"]
