"""Replay a past agent run.

Usage:
    python -m modal_app.harness.replay <runId>

Looks up the agent_runs row in Supabase using the service role key, rebuilds
the TriggerPayload from the stored input JSON, and spawns a fresh
run_article_agent invocation on Modal. The new run gets a NEW runId
(a fresh uuid) so it doesn't stomp the original row; the CLI prints both
the original runId and the new runId for cross-reference.

Required env (read from os.environ, matches the Modal secret bundle keys):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    APP_URL
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid

import httpx
import modal

from modal_app.harness.models import TriggerPayload


def _fetch_run(run_id: str) -> dict:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{base}/rest/v1/agent_runs?id=eq.{run_id}&select=*"
    with httpx.Client(timeout=20) as client:
        resp = client.get(url, headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        })
        resp.raise_for_status()
        rows = resp.json()
    if not rows:
        raise SystemExit(f"no agent_runs row found for id={run_id}")
    return rows[0]


def _rebuild_payload(row: dict, new_run_id: str) -> dict:
    input_blob = row.get("input") or {}
    # input_blob is whatever /api/agent/generate wrote (see agent-runs.ts createAgentRun).
    # Prefer fields from input; fall back to top-level columns.
    payload = {
        "runId": new_run_id,
        "userId": row["user_id"],
        "kind": input_blob.get("kind", row.get("kind", "article")),
        "topic": input_blob.get("topic", row.get("topic")),
        "focusKeyword": input_blob.get("focusKeyword") or row.get("focus_keyword"),
        "tone": input_blob.get("tone") or row.get("tone"),
        "targetAudience": input_blob.get("targetAudience") or row.get("target_audience"),
        "quality": input_blob.get("quality") or row.get("quality", "standard"),
        "options": input_blob.get("options") or row.get("options") or {},
        "autopilotSlotId": row.get("autopilot_slot_id"),
    }
    # Validate via pydantic so missing required fields fail fast.
    model = TriggerPayload.model_validate(payload)
    return model.model_dump()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Replay a past agent run on Modal")
    parser.add_argument("run_id", help="UUID of the agent_runs row to replay")
    parser.add_argument(
        "--app-name",
        default="article-sauce-agents",
        help="Modal app name (default: article-sauce-agents)",
    )
    parser.add_argument(
        "--fn-name",
        default="run_article_agent",
        help="Modal function name to invoke (default: run_article_agent)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the rebuilt payload but do not spawn on Modal",
    )
    args = parser.parse_args(argv)

    row = _fetch_run(args.run_id)
    new_run_id = str(uuid.uuid4())
    payload = _rebuild_payload(row, new_run_id)

    print(f"Original run: {args.run_id}  status={row.get('status')}  topic={row.get('topic')!r}")
    print(f"Replay run:   {new_run_id}")
    print(f"Payload:      {json.dumps(payload, indent=2)}")

    if args.dry_run:
        print("--dry-run specified; not spawning on Modal.")
        return 0

    fn = modal.Function.lookup(args.app_name, args.fn_name)
    call = fn.spawn(payload)
    print(f"Spawned Modal call: {call.object_id}")
    print("Watch logs with: modal app logs article-sauce-agents --follow")
    return 0


if __name__ == "__main__":
    sys.exit(main())
