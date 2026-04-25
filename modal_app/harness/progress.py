"""Async webhook progress emitter for the agent harness.

Every step in a run — agent start/end, tool start/end, free-form messages,
run-level status updates — is POSTed to the Next.js webhook at
``config.webhook_url()`` using the event schema in §7.2 of
``docs/project/09_agentic_generation.md``.

Design notes
------------
* The monotonic ``seq`` counter is per-``run_id`` so multiple concurrent runs
  on the same worker don't collide.
* Requests are HMAC-signed per §12 using ``AGENT_WEBHOOK_SECRET`` over the
  raw JSON body bytes (no whitespace normalization, matching the TS verifier).
* Transient 5xx / network errors are retried with exponential backoff via
  tenacity. 4xx responses are NOT retried — they're programmer errors.
* ``emit`` swallows all exceptions at the end of the retry chain: a webhook
  outage must never cause the agent run itself to fail.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import hmac
import json
import sys
import time
from datetime import datetime, timezone

import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from modal_app import config

# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------

_seq_lock = asyncio.Lock()
_seq_counters: dict[str, int] = {}

_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    """Lazily construct a shared httpx client with sensible pool limits."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=10.0,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
        )
    return _client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _next_seq(run_id: str) -> int:
    """Return the next monotonic sequence number for ``run_id``."""
    async with _seq_lock:
        n = _seq_counters.get(run_id, 0) + 1
        _seq_counters[run_id] = n
        return n


def _sign(raw: bytes) -> str:
    """HMAC-SHA256 signature in the ``sha256=<hex>`` format (see §12)."""
    mac = hmac.new(config.agent_webhook_secret().encode(), raw, hashlib.sha256)
    return "sha256=" + mac.hexdigest()


def _now_iso() -> str:
    """UTC ISO-8601 timestamp with millisecond precision and a ``Z`` suffix."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


# ---------------------------------------------------------------------------
# Transport
# ---------------------------------------------------------------------------


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return False


@retry(
    stop=stop_after_attempt(config.WEBHOOK_RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=0.2, min=0.2, max=2.0),
    retry=retry_if_exception(_is_retryable),
    reraise=True,
)
async def _post_with_retry(raw: bytes, headers: dict) -> None:
    resp = await _http().post(config.webhook_url(), content=raw, headers=headers)
    if resp.status_code >= 500:
        resp.raise_for_status()
    if 400 <= resp.status_code < 500:
        print(
            f"progress.emit got non-retryable {resp.status_code}: "
            f"{resp.text[:200]}",
            file=sys.stderr,
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def emit(
    run_id: str,
    kind: str,
    *,
    agent_name: str | None = None,
    tool_name: str | None = None,
    message: str | None = None,
    payload: dict | None = None,
    duration_ms: int | None = None,
    status_update: dict | None = None,
) -> None:
    """Emit a single webhook event; swallow network failures."""
    seq = await _next_seq(run_id)
    body = {
        "runId": run_id,
        "seq": seq,
        "kind": kind,
        "agentName": agent_name,
        "toolName": tool_name,
        "message": message,
        "payload": payload,
        "durationMs": duration_ms,
        "statusUpdate": status_update,
        "at": _now_iso(),
    }
    raw = json.dumps(body, separators=(",", ":")).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Signature": _sign(raw),
        "X-Agent-Run-Id": run_id,
    }
    try:
        await _post_with_retry(raw, headers)
    except Exception as e:  # never let the run fail due to webhook outage
        print(
            f"progress.emit failed for run {run_id} seq={seq} kind={kind}: {e}",
            file=sys.stderr,
        )


@contextlib.asynccontextmanager
async def tool_span(
    run_id: str,
    *,
    agent_name: str | None = None,
    tool_name: str,
    payload_preview: dict | None = None,
):
    """Bracket a tool invocation with ``tool_started`` / ``tool_ended`` events."""
    start = time.perf_counter()
    await emit(
        run_id,
        "tool_started",
        agent_name=agent_name,
        tool_name=tool_name,
        payload=payload_preview,
    )
    try:
        yield
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        await emit(
            run_id,
            "tool_ended",
            agent_name=agent_name,
            tool_name=tool_name,
            duration_ms=elapsed_ms,
        )
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        await emit(
            run_id,
            "tool_ended",
            agent_name=agent_name,
            tool_name=tool_name,
            duration_ms=elapsed_ms,
            message=f"error: {e!s}",
        )
        raise


@contextlib.asynccontextmanager
async def agent_span(run_id: str, agent_name: str):
    """Bracket a subagent invocation with ``agent_started`` / ``agent_ended``."""
    start = time.perf_counter()
    await emit(run_id, "agent_started", agent_name=agent_name)
    try:
        yield
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        await emit(
            run_id,
            "agent_ended",
            agent_name=agent_name,
            duration_ms=elapsed_ms,
        )
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        await emit(
            run_id,
            "agent_ended",
            agent_name=agent_name,
            duration_ms=elapsed_ms,
            message=f"error: {e!s}",
        )
        raise
