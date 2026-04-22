"""DALL-E-3 image generation + Supabase-storage handoff via /api/internal/upload-image."""

from __future__ import annotations

import hashlib

import openai

from modal_app import config
from modal_app.harness.models import GeneratedImage
from modal_app.harness.tools.storage import upload_image

_client: openai.AsyncOpenAI | None = None


def _oai() -> openai.AsyncOpenAI:
    global _client
    if _client is None:
        _client = openai.AsyncOpenAI(api_key=config.openai_api_key())
    return _client


async def generate_image(
    user_id: str, article_id: str, prompt: str, alt_text: str
) -> GeneratedImage:
    """Generate a DALL-E-3 image and upload to Supabase storage via the internal API.

    Returns a GeneratedImage record with storagePath + publicUrl. On failure,
    returns a record with ``success=False`` so the images subagent can decide
    whether to retry or ignore.
    """
    try:
        resp = await _oai().images.generate(
            model=config.MODEL_IMAGE,
            prompt=prompt,
            size="1792x1024",
            quality="standard",
            response_format="b64_json",
            n=1,
        )
        b64 = resp.data[0].b64_json or ""
        if not b64:
            return GeneratedImage(
                type="unknown",
                altText=alt_text,
                storagePath="",
                publicUrl="",
                success=False,
            )
        fname = f"{hashlib.sha256(prompt.encode()).hexdigest()[:8]}.png"
        upload = await upload_image(user_id, article_id, fname, b64)
        return GeneratedImage(
            type="inline",
            altText=alt_text,
            storagePath=upload["storagePath"],
            publicUrl=upload["publicUrl"],
            success=True,
        )
    except Exception:
        return GeneratedImage(
            type="error",
            altText=alt_text,
            storagePath="",
            publicUrl="",
            success=False,
        )
