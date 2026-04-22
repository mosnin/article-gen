"""Optional local-embed helper.

The dedup pipeline does NOT use this (Next.js owns embeddings for Upstash).
Exists for future in-run similarity / section-level deduping.
"""

import openai

from modal_app import config

_client: "openai.AsyncOpenAI | None" = None


def _oai() -> "openai.AsyncOpenAI":
    global _client
    if _client is None:
        _client = openai.AsyncOpenAI(api_key=config.openai_api_key())
    return _client


async def embed_text(text: str) -> list[float]:
    """Return a single OpenAI text-embedding-3-small vector (1536-d)."""
    resp = await _oai().embeddings.create(model=config.MODEL_EMBED, input=text)
    return list(resp.data[0].embedding)
