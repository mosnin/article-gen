"""Central config for the article-sauce agent harness.

Module-level constants hold model ids and tuning knobs. Env vars are read
lazily through @functools.cache-d getter functions so importing this module
never fails even when the Modal secret bundle is not attached (e.g. local
unit tests, type-checking, ruff).

See docs/project/09_agentic_generation.md §11 for the full env var list.
"""

from __future__ import annotations

import functools
import os

# ---------------------------------------------------------------------------
# Model ids & tuning
# ---------------------------------------------------------------------------

MODEL_ORCHESTRATOR = "gpt-4.1"
MODEL_SUBAGENT = "gpt-4.1-mini"
MODEL_WRITER = "gpt-4.1"
MODEL_IMAGE = "dall-e-3"
MODEL_EMBED = "text-embedding-3-small"

EMBED_DIMS = 1536
DEDUP_THRESHOLD = 0.88
DEFAULT_IMAGE_COUNT = 4
RUN_TIMEOUT_SECONDS = 1800
SUBAGENT_CONCURRENCY = 4
UPSTASH_INDEX_NAMESPACE_PREFIX = "user:"
WEBHOOK_RETRY_ATTEMPTS = 3


# ---------------------------------------------------------------------------
# Env var access (lazy, cached)
# ---------------------------------------------------------------------------


def _required(name: str) -> str:
    """Return os.environ[name] or raise RuntimeError with a stable message."""
    try:
        return os.environ[name]
    except KeyError as e:
        raise RuntimeError(f"missing env {name}") from e


@functools.cache
def openai_api_key() -> str:
    return _required("OPENAI_API_KEY")


@functools.cache
def supabase_url() -> str:
    return _required("SUPABASE_URL")


@functools.cache
def supabase_service_role_key() -> str:
    return _required("SUPABASE_SERVICE_ROLE_KEY")


@functools.cache
def exa_api_key() -> str:
    return _required("EXA_API_KEY")


@functools.cache
def upstash_vector_rest_url() -> str:
    return _required("UPSTASH_VECTOR_REST_URL")


@functools.cache
def upstash_vector_rest_token() -> str:
    return _required("UPSTASH_VECTOR_REST_TOKEN")


@functools.cache
def agent_webhook_secret() -> str:
    return _required("AGENT_WEBHOOK_SECRET")


@functools.cache
def agent_internal_secret() -> str:
    return _required("AGENT_INTERNAL_SECRET")


@functools.cache
def modal_agent_token() -> str:
    return _required("MODAL_AGENT_TOKEN")


@functools.cache
def app_url() -> str:
    return _required("APP_URL")


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------


def internal_api(path: str) -> str:
    """Build an /api/internal URL.

    ``path`` must start with ``/`` (or be empty, in which case this returns
    the base ``{APP_URL}/api/internal`` — used by modal_app.py to populate
    ``TriggerPayload.internalApiBase``).
    """
    if path and not path.startswith("/"):
        raise ValueError(f"internal_api path must start with '/', got {path!r}")
    return f"{app_url().rstrip('/')}/api/internal{path}"


def webhook_url() -> str:
    """Full URL for the Next.js agent webhook endpoint."""
    return f"{app_url().rstrip('/')}/api/agent/webhook"
