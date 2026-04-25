"""SocialPublisher tools.

Three @function_tools:
  - fetch_snippets        -> POSTs to /api/internal/fetch-snippets to retrieve
                             the snippet rows + the matching social_account
                             (oauth_token is NEVER returned to Python; only a
                             ``hasOauthToken`` boolean).
  - post_to_webhook       -> direct httpx POST to the user-controlled webhook
                             URL with SSRF screening (http(s) only, no private
                             IP ranges, no localhost).
  - record_publish_result -> POSTs to /api/internal/record-publish-result to
                             stamp ``posted_at`` + ``external_url`` on success.

Result shape from ``post_to_webhook``::

    {
      "success": bool,
      "externalUrl": str | None,
      "error": str | None,
      "statusCode": int | None,
    }
"""
from __future__ import annotations

import ipaddress
import json
from typing import Any
from urllib.parse import urlparse

import httpx

from modal_app.harness.tools.http import post_internal


# ---------------------------------------------------------------------------
# SSRF screening
# ---------------------------------------------------------------------------

_BLOCKED_HOSTS: set[str] = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.169.254",          # AWS metadata
    "metadata.google.internal", # GCP metadata
}


def _is_private_ip(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _validate_webhook_url(raw_url: str) -> tuple[bool, str]:
    """Returns (ok, error_message). Only allow http(s); block private IPs."""
    if not raw_url or not isinstance(raw_url, str):
        return False, "missing_webhook_url"
    try:
        parsed = urlparse(raw_url)
    except Exception:
        return False, "invalid_url"
    if parsed.scheme not in ("http", "https"):
        return False, f"unsupported_scheme:{parsed.scheme}"
    host = (parsed.hostname or "").lower()
    if not host:
        return False, "missing_host"
    if host in _BLOCKED_HOSTS:
        return False, "blocked_host"
    if _is_private_ip(host):
        return False, "blocked_private_ip"
    return True, ""


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

# Re-import lazily inside the wrapper so that this module can be imported in
# environments where the agents SDK is not available (tests / static checks).
try:
    from agents import function_tool
except ImportError:  # pragma: no cover - SDK absent in some build paths
    def function_tool(fn):  # type: ignore[no-redef]
        return fn


_WEBHOOK_TIMEOUT_S = 20.0


@function_tool
async def fetch_snippets(user_id: str, snippet_ids: list[str]) -> dict:
    """Fetch ``social_snippets`` rows + their matching ``social_account``.

    Hits ``/api/internal/fetch-snippets``. Returns
    ``{"snippets": [{id, platform, variant, body, hashtags, imageUrl,
    sourceArticleId, account: {id, webhookUrl, hasOauthToken}}]}``.
    The account.oauth_token is NEVER sent to Python - only ``hasOauthToken``.
    """
    if not snippet_ids:
        return {"snippets": []}
    return await post_internal(
        "/fetch-snippets",
        {"userId": user_id, "snippetIds": list(snippet_ids)},
    )


@function_tool
async def post_to_webhook(account_webhook_url: str, payload: dict) -> dict:
    """POST the snippet payload directly to a user-controlled webhook URL.

    Returns ``{success, externalUrl?, error?, statusCode}``. SSRF: only
    http(s) is allowed; loopback / private / link-local IPs are rejected.
    Non-2xx responses are treated as failure with the body trimmed into
    the error message. The remote may return an ``externalUrl`` field in
    its JSON response, which is forwarded back to the caller.
    """
    ok, err = _validate_webhook_url(account_webhook_url)
    if not ok:
        return {
            "success": False,
            "externalUrl": None,
            "error": err,
            "statusCode": None,
        }

    raw = json.dumps(payload, separators=(",", ":"), default=str).encode()
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "ArticleGen-SocialPublisher/1.0",
    }

    try:
        async with httpx.AsyncClient(timeout=_WEBHOOK_TIMEOUT_S) as client:
            resp = await client.post(account_webhook_url, content=raw, headers=headers)
    except httpx.TimeoutException:
        return {
            "success": False,
            "externalUrl": None,
            "error": "webhook_timeout",
            "statusCode": None,
        }
    except httpx.TransportError as e:
        return {
            "success": False,
            "externalUrl": None,
            "error": f"webhook_transport_error:{e!s}"[:300],
            "statusCode": None,
        }
    except Exception as e:
        return {
            "success": False,
            "externalUrl": None,
            "error": f"webhook_exception:{e!s}"[:300],
            "statusCode": None,
        }

    status = resp.status_code
    body_text = (resp.text or "")[:1000]
    if status < 200 or status >= 300:
        return {
            "success": False,
            "externalUrl": None,
            "error": f"http_{status}:{body_text}"[:500],
            "statusCode": status,
        }

    external_url: str | None = None
    parsed_body: Any = None
    ctype = (resp.headers.get("content-type") or "").lower()
    if "application/json" in ctype:
        try:
            parsed_body = resp.json()
        except Exception:
            parsed_body = None
    if isinstance(parsed_body, dict):
        cand = parsed_body.get("externalUrl") or parsed_body.get("url")
        if isinstance(cand, str) and cand.startswith(("http://", "https://")):
            external_url = cand

    return {
        "success": True,
        "externalUrl": external_url,
        "error": None,
        "statusCode": status,
    }


@function_tool
async def record_publish_result(
    user_id: str,
    snippet_id: str,
    success: bool,
    external_url: str | None = None,
    error: str | None = None,
) -> dict:
    """POST to ``/api/internal/record-publish-result`` so the snippet row
    is updated (``posted_at`` + ``external_url`` on success). Returns
    ``{ok: true}`` on the happy path."""
    body: dict = {
        "userId": user_id,
        "snippetId": snippet_id,
        "success": bool(success),
    }
    if external_url is not None:
        body["externalUrl"] = external_url
    if error is not None:
        body["error"] = error
    return await post_internal("/record-publish-result", body)
