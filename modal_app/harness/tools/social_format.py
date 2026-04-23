"""Social-format snippet tools.

Prompt-driven composer (calls OpenAI directly, same pattern as
``openai_tools.py``) plus the save helper that hits the internal API.
"""
from __future__ import annotations

import json

import openai

from modal_app import config
from modal_app.harness.tools.http import get_run_id, post_internal


_client: openai.AsyncOpenAI | None = None


def _oai() -> openai.AsyncOpenAI:
    global _client
    if _client is None:
        _client = openai.AsyncOpenAI(api_key=config.openai_api_key())
    return _client


PLATFORM_HINTS: dict[str, str] = {
    "twitter": (
        "A single tweet under 280 chars AND a 5-8 tweet thread, "
        "labeled 'single' and 'thread'."
    ),
    "linkedin": (
        "A 150-250 word post, 2-3 short paragraphs, natural tone, clear CTA."
    ),
    "instagram": (
        "A caption: hook + 3-5 sentence body + 5-10 relevant hashtags."
    ),
    "facebook": "A 50-120 word post with a short CTA.",
    "newsletter": (
        "A 200-400 word digest-style snippet with its own headline."
    ),
}


async def compose_snippet(
    *,
    platform: str,
    variant: str,
    article_title: str,
    article_markdown: str,
) -> dict:
    """Produce one platform-native snippet. Returns
    {platform, variant, body, hashtags}."""
    hint = PLATFORM_HINTS.get(platform, PLATFORM_HINTS["linkedin"])
    system = (
        "You are a social-copy writer. Rewrite the given article into a "
        "single platform-native snippet. Return JSON with keys: platform, "
        "variant, body (string), hashtags (array of strings, can be empty). "
        "Do not use em-dashes or en-dashes anywhere."
    )
    user = (
        f"Platform: {platform}\n"
        f"Variant: {variant}\n"
        f"Constraints: {hint}\n"
        f"Do not use em-dashes.\n\n"
        f"Article title: {article_title}\n\n"
        f"Article markdown:\n{article_markdown[:6000]}"
    )
    resp = await _oai().chat.completions.create(
        model=config.MODEL_SUBAGENT,
        temperature=0.7,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {}
    return {
        "platform": platform,
        "variant": variant,
        "body": str(data.get("body", "")),
        "hashtags": [str(h) for h in (data.get("hashtags") or [])],
    }


async def save_snippets(
    *, user_id: str, article_id: str, snippets: list[dict]
) -> dict:
    """POST the snippets to /api/internal/save-social-snippets.

    ``runId`` is pulled from the shared ContextVar set by the orchestrator
    entrypoint so tools don't have to thread it through every call.
    """
    body = {
        "userId": user_id,
        "runId": get_run_id() or "",
        "articleId": article_id,
        "snippets": snippets,
    }
    return await post_internal("/save-social-snippets", body)
