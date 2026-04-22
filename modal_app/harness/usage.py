"""Per-run token + cost aggregation.

Cost constants are approximate and match OpenAI public pricing (USD per 1M
tokens) as of April 2026. Update when pricing changes.
"""
from __future__ import annotations

from typing import Any

# USD per 1M tokens. Structure: model -> (input, output).
_PRICE_PER_M: dict[str, tuple[float, float]] = {
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "text-embedding-3-small": (0.02, 0.02),
}
_IMAGE_USD = {"dall-e-3": 0.040}  # per 1792x1024 standard quality


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
        base = next((k for k in _PRICE_PER_M if model.startswith(k)), "gpt-4.1-mini")
        pin, pout = _PRICE_PER_M[base]
        cost += (in_tok / 1_000_000) * pin + (out_tok / 1_000_000) * pout
    return {
        "tokensIn": tokens_in,
        "tokensOut": tokens_out,
        "costUsd": round(cost, 4),
    }


def image_cost_usd(count: int, model: str = "dall-e-3") -> float:
    """Flat USD cost for ``count`` generated images of ``model``."""
    return round(count * _IMAGE_USD.get(model, 0.0), 4)
