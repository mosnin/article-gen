"""Modal app for article-sauce-agents.

Exposes a signed HTTPS ``/trigger`` endpoint (HMAC over raw body with
``MODAL_AGENT_TOKEN``) that spawns ``run_article_agent`` and returns the
Modal call id. The long-running function drives the orchestrator and emits
progress back to the Next.js webhook.

Deploy: ``modal deploy modal_app/modal_app.py``
Local dev: ``modal serve modal_app/modal_app.py``
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import traceback

import modal
from fastapi import HTTPException, Request

from modal_app import config
from modal_app.harness.models import TriggerPayload

# ---------------------------------------------------------------------------
# App definition
# ---------------------------------------------------------------------------

app = modal.App("article-sauce-agents")

# Image: preferred path uses the pinned ``agents/requirements.txt`` checked
# into the repo so Modal and local dev share one source of truth. If that
# file is not present in the build context (e.g. running ``modal serve`` from
# a different cwd) we fall back to an explicit pin list with the same set of
# packages. Both code paths produce an equivalent environment.
try:
    image = modal.Image.debian_slim(python_version="3.11").pip_install_from_requirements(
        "agents/requirements.txt"
    )
except Exception:
    # Explicit fallback with the exact pins from agents/requirements.txt.
    image = modal.Image.debian_slim(python_version="3.11").pip_install(
        "modal>=0.66,<0.80",
        "openai-agents>=0.0.6",
        "openai>=1.50,<2",
        "httpx>=0.27,<1",
        "pydantic>=2.8,<3",
        "tenacity>=9,<10",
        "exa-py>=1.3,<2",
        "upstash-vector>=0.6,<1",
        "python-dotenv>=1.0,<2",
        "fastapi>=0.110",
    )

secret = modal.Secret.from_name("article-sauce-agents")


# ---------------------------------------------------------------------------
# HTTPS trigger (HMAC-guarded)
# ---------------------------------------------------------------------------


@app.function(image=image, secrets=[secret], timeout=60)
@modal.fastapi_endpoint(method="POST", label="trigger")
async def trigger(request: Request) -> dict:
    """Verify HMAC, parse the TriggerPayload, and spawn ``run_article_agent``."""
    body = await request.body()

    provided = request.headers.get("X-Signature") or request.headers.get("x-signature")
    if not provided:
        raise HTTPException(status_code=401, detail="missing signature")

    expected = (
        "sha256=" + hmac.new(config.modal_agent_token().encode(), body, hashlib.sha256).hexdigest()
    )
    if not hmac.compare_digest(expected, provided):
        raise HTTPException(status_code=401, detail="invalid signature")

    payload = TriggerPayload.model_validate_json(body)

    if payload.webhookUrl is None:
        payload.webhookUrl = config.webhook_url()
    if payload.internalApiBase is None:
        # config.internal_api("") → "{APP_URL}/api/internal"
        payload.internalApiBase = config.internal_api("")

    call = run_article_agent.spawn(payload.model_dump())
    return {"modalCallId": call.object_id, "runId": payload.runId}


# ---------------------------------------------------------------------------
# Long-running orchestrator entrypoint
# ---------------------------------------------------------------------------


@app.function(
    image=image,
    secrets=[secret],
    timeout=config.RUN_TIMEOUT_SECONDS,
    retries=modal.Retries(max_retries=0),
)
async def run_article_agent(payload: dict) -> dict:
    """Drive the orchestrator, emit run_started/run_completed/run_failed events."""
    # Lazy import: the harness subpackage is developed in parallel and may not
    # exist yet at the time this module is first imported by Modal's build
    # step. Importing here keeps the image build + endpoint deploy green.
    try:
        from modal_app.harness import orchestrator, progress  # type: ignore
    except Exception as e:
        print(f"[run_article_agent] orchestrator not importable yet: {e}")
        return {"error": "orchestrator not implemented"}

    run_id = payload["runId"]

    await _safe_emit(
        progress,
        run_id=run_id,
        kind="run_started",
        status_update={"status": "running", "progressPct": 0, "currentStep": "boot"},
    )

    try:
        result = await asyncio.wait_for(
            orchestrator.run(payload),
            timeout=config.RUN_TIMEOUT_SECONDS - 30,
        )
        await _safe_emit(
            progress,
            run_id=run_id,
            kind="run_completed",
            status_update={
                "status": "succeeded",
                "progressPct": 100,
                "articleId": result.get("articleId"),
                "output": result,
            },
        )
        return result
    except asyncio.TimeoutError:
        await _safe_emit(
            progress,
            run_id=run_id,
            kind="run_failed",
            status_update={"status": "failed", "error": "timeout"},
            error="timeout",
        )
        raise
    except Exception as e:
        tb = traceback.format_exc()
        await _safe_emit(
            progress,
            run_id=run_id,
            kind="run_failed",
            status_update={"status": "failed", "error": str(e)},
            error=str(e),
            payload={"traceback": tb},
        )
        raise


async def _safe_emit(progress_mod, **kwargs) -> None:
    """Call progress.emit, tolerating sync or async implementations.

    The harness's ``progress`` module has not yet been written, so this
    wrapper swallows any emit errors to avoid masking the original
    exception in ``run_article_agent``.
    """
    try:
        emit = getattr(progress_mod, "emit", None)
        if emit is None:
            return
        result = emit(**kwargs)
        if asyncio.iscoroutine(result):
            await result
    except Exception as e:
        print(f"[progress.emit] suppressed: {e}")


# ---------------------------------------------------------------------------
# Local entrypoint
# ---------------------------------------------------------------------------


@app.local_entrypoint()
def main():
    print("article-sauce-agents — deploy with: modal deploy modal_app/modal_app.py")
