"""CannibalizationResolver tools — pgvector pair scan + resolution persistence."""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def find_cannibalization_pairs(user_id: str, threshold: float = 0.85) -> dict:
    """Find article pairs in the user's corpus whose pgvector cosine
    similarity meets or exceeds ``threshold``. Pairs are undirected and
    returned at most once each. Returns
    { pairs: [{primaryArticleId, secondaryArticleId, similarityScore,
    sharedKeywords}], pairsScanned }."""
    return await post_internal(
        "/find-cannibalization-pairs",
        {"userId": user_id, "threshold": threshold},
    )


@function_tool
async def save_cannibalization_resolutions(
    user_id: str, resolutions: list[dict]
) -> dict:
    """Persist cannibalization resolutions. Each entry:
    {primaryArticleId, secondaryArticleId, similarityScore, sharedKeywords,
    recommendedAction (one of merge|canonical|archive_secondary|
    retarget_secondary|no_action), rationale}.
    The unique partial index on (user_id, least(a,b), greatest(a,b))
    deduplicates undirected pairs across runs.
    Returns {insertedCount, skippedCount}."""
    return await post_internal(
        "/save-cannibalization-resolutions",
        {
            "userId": user_id,
            "runId": get_run_id(),
            "resolutions": resolutions,
        },
    )
