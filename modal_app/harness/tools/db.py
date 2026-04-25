"""DB-facing tools.

All go through Next.js /api/internal/* so the Supabase service-role key
never leaves Vercel.
"""

from __future__ import annotations

from modal_app.harness.models import ArticleSavePayload, CreditsStatus, SavedArticleRef
from modal_app.harness.tools.http import get_user_id, post_internal


async def save_article(payload: ArticleSavePayload) -> SavedArticleRef:
    # Re-use payload.runId as the idempotency key (`agentRunId`) when not
    # explicitly set, so retries of the same run resolve to the same row via
    # the unique partial index on articles(agent_run_id).
    body = payload.model_dump()
    if not body.get("agentRunId"):
        body["agentRunId"] = body.get("runId")
    data = await post_internal("/save-article", body)
    return SavedArticleRef.model_validate(data)


async def update_article(
    article_id: str, patch: dict, *, user_id: str | None = None
) -> None:
    uid = user_id or get_user_id()
    if not uid:
        raise RuntimeError(
            "update_article requires user_id (pass explicitly or call set_user_id "
            "from orchestrator before invoking)"
        )
    await post_internal(
        "/update-article",
        {"articleId": article_id, "userId": uid, "patch": patch},
    )


async def check_credits(user_id: str, amount: int = 1) -> CreditsStatus:
    data = await post_internal("/check-credits", {"userId": user_id, "amount": amount})
    return CreditsStatus.model_validate(data)


async def deduct_credit(
    user_id: str, article_id: str | None, description: str
) -> int:
    data = await post_internal(
        "/deduct-credit",
        {"userId": user_id, "articleId": article_id, "description": description},
    )
    return int(data["credits"])


async def fetch_user_articles(user_id: str, limit: int = 20) -> list[dict]:
    data = await post_internal("/user-articles", {"userId": user_id, "limit": limit})
    return list(data.get("articles", []))
