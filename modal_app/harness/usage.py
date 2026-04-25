"""Per-run token + cost aggregation.

Cost constants are approximate and match OpenAI public pricing (USD per 1M
tokens) as of April 2026. Update when pricing changes.
"""
from __future__ import annotations

import contextvars
from typing import Any

# USD per 1M tokens. Structure: model -> (input, output).
_PRICE_PER_M: dict[str, tuple[float, float]] = {
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "text-embedding-3-small": (0.02, 0.02),
}
_IMAGE_USD = {"dall-e-3": 0.040}  # per 1792x1024 standard quality


# Per-run accumulator of (model, input_tokens, output_tokens) tuples from
# direct OpenAI calls in tools (which bypass the SDK Runner trace).
_extra_usage: contextvars.ContextVar[list[dict]] = contextvars.ContextVar(
    "agent_extra_usage", default=[]
)
_extra_images: contextvars.ContextVar[list[dict]] = contextvars.ContextVar(
    "agent_extra_images", default=[]
)


def reset_extra_usage() -> None:
    """Reset the per-run extra-usage accumulators (call at run start)."""
    _extra_usage.set([])
    _extra_images.set([])


def record_extra_usage(model: str, input_tokens: int, output_tokens: int) -> None:
    """Record token counts from a direct OpenAI completion call."""
    bucket = list(_extra_usage.get())
    bucket.append(
        {
            "model": model,
            "input_tokens": int(input_tokens or 0),
            "output_tokens": int(output_tokens or 0),
        }
    )
    _extra_usage.set(bucket)


def drain_extra_usage() -> list[dict]:
    """Return + clear the accumulated extra token usage records."""
    bucket = _extra_usage.get()
    _extra_usage.set([])
    return list(bucket)


def record_image_usage(count: int = 1, model: str = "dall-e-3") -> None:
    """Record ``count`` generated images of ``model`` for separate cost rollup."""
    bucket = list(_extra_images.get())
    bucket.append({"model": model, "count": int(count or 0)})
    _extra_images.set(bucket)


def drain_extra_images() -> list[dict]:
    """Return + clear the accumulated image-usage records."""
    bucket = _extra_images.get()
    _extra_images.set([])
    return list(bucket)


def _resolve_base(model: str) -> str:
    """Match ``model`` to the longest known prefix in ``_PRICE_PER_M``.

    Sorting longest-first prevents a model id like ``gpt-4.1-mini-2026-01-01``
    from matching the shorter ``gpt-4.1`` prefix and getting the wrong price.
    """
    return next(
        (
            k
            for k in sorted(_PRICE_PER_M, key=len, reverse=True)
            if model.startswith(k)
        ),
        "gpt-4.1-mini",
    )


def aggregate_usage(raw_responses: list[Any]) -> dict:
    """Sum tokens and compute USD cost from a RunResult.raw_responses list.

    Returns ``{ tokensIn: int, tokensOut: int, costUsd: float }``.
    Best-effort - if the SDK shape changes, returns zeros rather than raising.
    """
    tokens_in = 0
    tokens_out = 0
    cost = 0.0
    for resp in raw_responses or []:
        usage = getattr(resp, "usage", None)
        if usage is None:
            continue
        in_tok = int(getattr(usage, "input_tokens", 0) or 0)
        out_tok = int(getattr(usage, "output_tokens", 0) or 0)
        tokens_in += in_tok
        tokens_out += out_tok
        model = (
            getattr(resp, "model", None)
            or getattr(resp, "model_name", None)
            or "gpt-4.1-mini"
        )
        # Normalize (strip date suffixes like gpt-4.1-mini-2026-01-01)
        base = _resolve_base(model)
        pin, pout = _PRICE_PER_M[base]
        cost += (in_tok / 1_000_000) * pin + (out_tok / 1_000_000) * pout
    return {
        "tokensIn": tokens_in,
        "tokensOut": tokens_out,
        "costUsd": round(cost, 4),
    }


def aggregate_extra_usage(records: list[dict]) -> dict:
    """Sum tokens + USD cost from records produced by ``record_extra_usage``.

    Returns ``{ tokensIn: int, tokensOut: int, costUsd: float }``.
    """
    tokens_in = 0
    tokens_out = 0
    cost = 0.0
    for rec in records or []:
        in_tok = int(rec.get("input_tokens", 0) or 0)
        out_tok = int(rec.get("output_tokens", 0) or 0)
        tokens_in += in_tok
        tokens_out += out_tok
        model = rec.get("model") or "gpt-4.1-mini"
        base = _resolve_base(model)
        pin, pout = _PRICE_PER_M[base]
        cost += (in_tok / 1_000_000) * pin + (out_tok / 1_000_000) * pout
    return {
        "tokensIn": tokens_in,
        "tokensOut": tokens_out,
        "costUsd": round(cost, 4),
    }


def aggregate_extra_images(records: list[dict]) -> dict:
    """Sum image counts + flat USD cost from ``record_image_usage`` records."""
    total = 0
    cost = 0.0
    for rec in records or []:
        n = int(rec.get("count", 0) or 0)
        model = rec.get("model") or "dall-e-3"
        total += n
        cost += n * _IMAGE_USD.get(model, 0.0)
    return {"images": total, "costUsd": round(cost, 4)}


def image_cost_usd(count: int, model: str = "dall-e-3") -> float:
    """Flat USD cost for ``count`` generated images of ``model``."""
    return round(count * _IMAGE_USD.get(model, 0.0), 4)
