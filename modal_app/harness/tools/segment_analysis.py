"""UserSegment tools — corpus-summary retrieval + segment persistence.

The agent first asks the internal API for a compact summary of the user's
content posture (niche, autopilot niche, autonomous schedules, recent
articles), then synthesizes a ``UserSegment`` and persists it back via a
second internal endpoint. Each call inserts a fresh snapshot row — the
"latest wins" convention is enforced by readers ordering by ``created_at``
desc.
"""
from __future__ import annotations

from modal_app.harness.tools.http import get_run_id, post_internal


async def list_user_corpus_summary(user_id: str, limit: int = 100) -> dict:
    """Fetch a compact summary of the user's content posture.

    POSTs to ``/list-user-corpus-summary`` which returns

        {
          "userId": ...,
          "niche": ...,
          "autopilotNiche": ...,
          "autonomousSchedules": [{"name", "niche", "cadence"}, ...],
          "articles": [{"title", "focusKeyword", "topic", "keywords"}, ...]
        }

    Articles are capped at 100 (token-budget guard) regardless of the
    requested ``limit``.
    """
    capped = max(1, min(100, int(limit)))
    return await post_internal(
        "/list-user-corpus-summary",
        {"userId": user_id, "limit": capped},
    )


async def save_user_segment(user_id: str, segment: dict) -> dict:
    """Persist a UserSegment snapshot.

    ``segment`` is the camelCase dict matching the Pydantic ``UserSegment``
    shape (personaLabel, personaDescription, industry, businessModel,
    audienceTechnicalLevel, primaryGoals, brandVoice, contentPillars,
    toneKeywords, confidence). Returns ``{"segmentId": "..."}``.

    Each call INSERTs a new row — readers should select the most recent
    row per ``user_id`` (ORDER BY created_at DESC LIMIT 1).
    """
    return await post_internal(
        "/save-user-segment",
        {"userId": user_id, "runId": get_run_id(), "segment": segment},
    )
