"""Shared signed HTTP client for calling Next.js /api/internal/* endpoints.

Provides HMAC body signing, a ``run_id`` ContextVar so tool modules don't have
to thread run ids through every call, and a lazily initialised singleton
``httpx.AsyncClient`` with connection pooling.
"""

from __future__ import annotations

import contextvars
import hashlib
import hmac
import json

import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from modal_app import config


def _is_http_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return False

_run_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "agent_run_id", default=None
)
_user_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "agent_user_id", default=None
)


def set_run_id(run_id: str) -> None:
    _run_id_ctx.set(run_id)


def get_run_id() -> str | None:
    return _run_id_ctx.get()


def set_user_id(user_id: str) -> None:
    _user_id_ctx.set(user_id)


def get_user_id() -> str | None:
    return _user_id_ctx.get()


_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
        )
    return _client


def sign_body(raw: bytes) -> str:
    return "sha256=" + hmac.new(
        config.agent_internal_secret().encode(), raw, hashlib.sha256
    ).hexdigest()


async def post_internal(path: str, body: dict, run_id: str | None = None) -> dict:
    """POST to internal API with HMAC auth. Raises httpx.HTTPStatusError on non-2xx."""
    if not path.startswith("/"):
        raise ValueError("path must start with '/'")
    url = config.internal_api(path)
    raw = json.dumps(body, separators=(",", ":")).encode()
    rid = run_id or get_run_id() or ""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.agent_internal_secret()}",
        "X-Agent-Run-Id": rid,
        "X-Signature": sign_body(raw),
    }
    resp = await _http().post(url, content=raw, headers=headers)
    resp.raise_for_status()
    return resp.json()
