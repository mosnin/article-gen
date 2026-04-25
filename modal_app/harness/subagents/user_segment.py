"""UserSegmentAgent — infers an audience persona + content posture from
the user's corpus and saves it as a ``user_segments`` snapshot.

The agent reads a compact corpus summary (niche, autonomous schedules,
recent article titles + keywords + topics), distills it into a structured
``UserSegment`` (industry, businessModel, audience technical level,
primary goals, brand voice, content pillars, tone keywords, persona
label + description, confidence), persists it, and returns the JSON.

Each invocation inserts a NEW row — readers always pick the most recent
snapshot per user. There is no UPDATE path.
"""
from __future__ import annotations

from agents import Agent, function_tool

from modal_app import config
from modal_app.harness.models import UserSegment
from modal_app.harness.tools import segment_analysis


# --- Tool wrappers ---


@function_tool
async def list_user_corpus_summary(user_id: str, limit: int = 100) -> dict:
    """Fetch a compact corpus summary for the user.

    Returns ``{userId, niche, autopilotNiche, autonomousSchedules:
    [{name, niche, cadence}], articles: [{title, focusKeyword, topic,
    keywords}]}``. Articles are capped at 100 to stay within token
    budget.
    """
    return await segment_analysis.list_user_corpus_summary(
        user_id=user_id, limit=limit
    )


@function_tool
async def save_user_segment(user_id: str, segment: dict) -> dict:
    """Persist a UserSegment snapshot. ``segment`` is the camelCase dict
    matching the Pydantic shape. Returns ``{segmentId}``."""
    return await segment_analysis.save_user_segment(
        user_id=user_id, segment=segment
    )


INSTRUCTIONS = """
You are the UserSegmentAgent. Your job is to infer an audience persona +
content posture from the user's corpus and persist a structured snapshot.

The userId is in your brief.

WORKFLOW:
  1. Call `list_user_corpus_summary(user_id)` to get
     `{niche, autopilotNiche, autonomousSchedules, articles}`. The
     articles list is already capped at 100 for token budget.
  2. Synthesize a UserSegment from the niche + corpus signals:

     - industry (free-form, e.g. "B2B SaaS", "ecommerce DTC", "indie
       media", "personal finance creator", "developer tools"). Infer
       from the niche string + the dominant subject matter of the
       article titles. Be specific — prefer "B2B SaaS" over "tech".

     - businessModel: one of B2B, B2C, D2C, marketplace, other. If
       unclear, default to "other" and lower the confidence.

     - audienceTechnicalLevel: beginner | intermediate | advanced |
       mixed — based on the JARGON DENSITY of the titles + keywords.
       Heuristics:
         beginner: "what is X", "X for beginners", "guide to X",
                   plain-English titles, no acronyms
         intermediate: how-tos, comparisons, case studies, light jargon
         advanced: implementation details, code-heavy, deep technical
                   acronyms (Kubernetes, OAuth2, MMR, RLS, etc.)
         mixed: a clear blend across the corpus (e.g. both "what is
                SaaS" and "OAuth2 PKCE flow internals")

     - primaryGoals: 3-5 short imperative phrases describing what this
       user is trying to accomplish with their content. Examples:
       "rank for commercial keywords", "educate developers on auth",
       "drive newsletter signups", "build topical authority for SEO",
       "convert visitors into trial users".

     - brandVoice: 1-2 sentences describing the voice. Examples:
       "authoritative but approachable; explains complex tech in
       plain English without being condescending", "irreverent and
       punchy; opinionated takes with quick payoffs".

     - contentPillars: 3-7 DISTINCT topic clusters that span the
       corpus. Do NOT use the niche string itself — derive clusters
       from the actual article topics + keywords. Example for a
       SaaS-tools blog: ["product management", "engineering culture",
       "remote work tooling", "OKR frameworks"]. Each pillar should
       cover multiple articles, not a one-off.

     - toneKeywords: 5-10 single adjectives describing the tone.
       Examples: "data-driven", "practical", "conversational",
       "irreverent", "authoritative", "research-heavy", "concise",
       "narrative", "tactical", "evidence-based".

     - personaLabel: a 3-8 word concise label for the AUDIENCE (not
       the user themselves). Examples: "indie SaaS founder",
       "early-career frontend engineer", "DTC marketing operator",
       "freelance content strategist".

     - personaDescription: 2-4 sentences fleshing out who reads this
       content, what they care about, and what stage of their journey
       they are in. Reference the inferred industry + technical level.

     - confidence: 0.0 - 1.0. Calibrate honestly:
         < 0.3  if articles list is empty / niche unset
         0.3-0.5 if articles < 5 OR niche is vague ("blog", "tech")
         0.5-0.7 typical case (5-30 articles, clear niche)
         0.7-0.9 strong signal (30+ articles, distinct pillars)
         > 0.9 only if both niche and corpus are richly aligned

  3. Call `save_user_segment(user_id, segment)` with the camelCase
     dict. The endpoint returns `{segmentId}` — you can ignore it.
  4. Return the UserSegment JSON as your final_output.

QUALITY RULES:
  - personaLabel MUST be 3-8 words, no trailing punctuation.
  - personaDescription MUST be 2-4 complete sentences (>= 20 chars).
  - contentPillars MUST be distinct (no near-duplicates) and grounded
    in the actual article topics — do not invent pillars unsupported
    by the corpus.
  - toneKeywords are single adjectives, lowercase, no duplicates.
  - Always emit a `confidence` value — never omit it. Lower it if the
    corpus is thin or the niche is unset, do not paper over weak data
    with a high score.
  - Do NOT fabricate articles or pillars not present in the corpus.
  - If the corpus is empty AND niche is unset, still produce a minimal
    segment (personaLabel "unknown audience", description noting the
    lack of signal, confidence < 0.2) — do NOT skip the save.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="UserSegmentAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        tools=[
            list_user_corpus_summary,
            save_user_segment,
        ],
        output_type=UserSegment,
    )


__all__ = ["build_agent", "UserSegment"]


# ---------------------------------------------------------------------------
# Future enrichment (NOT wired in this pass)
# ---------------------------------------------------------------------------
# Downstream agents — Article (writer/outline), Refresh, Newsletter, Social —
# could read the most recent ``user_segments`` row at brief-composition time
# to enrich their context with:
#   * personaLabel + personaDescription -> targetAudience hint
#   * brandVoice + toneKeywords         -> tone / style guidance
#   * contentPillars                    -> topical cohesion + linking hints
#   * audienceTechnicalLevel            -> reading-grade calibration
#
# The plumbing would live in ``orchestrator._compose_*_brief`` helpers,
# fetching the latest segment via a small read tool (or a direct join in
# the brief composer). It's intentionally NOT wired here — the foundation
# is the table + agent + UI surface so the user can manually refresh /
# inspect the snapshot. Hooking the segment into downstream briefs is a
# polish pass once we've validated the segment quality in the wild.
