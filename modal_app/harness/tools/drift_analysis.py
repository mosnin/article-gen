"""PromptDriftDetector tools — sample QAAgent quality scores and persist alerts.

`sample_quality_scores` POSTs `/api/internal/sample-quality-scores` to gather
mean QAAgent quality scores per `agent_kind` for a current window vs an
immediately-prior baseline window. The route normalises two possible sources:
    1. `agent_runs.output->'qa'->>'overall'` (when QAAgent persists into the
       run's final output JSONB blob)
    2. The latest `agent_events` row for that run with kind='message' and
       agent_name='QAAgent', extracting `payload->>'overallScore'`

`save_drift_alerts` persists the agent's `PromptDriftAlert[]` via
`/api/internal/save-drift-alerts`. For `scope="global"` the userId column is
NULL so alerts are visible only to admins (per RLS).
"""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def sample_quality_scores(
    scope: str,
    user_id_opt: str | None,
    period_days: int = 30,
    baseline_days: int = 30,
) -> dict:
    """Sample QAAgent overall scores per agent_kind for two adjacent windows.

    Args:
      scope: "global" (all users) or "user" (single user).
      user_id_opt: required when scope="user", otherwise ignored.
      period_days: width of the CURRENT window, ending now.
      baseline_days: width of the BASELINE window, ending where current begins.

    Returns:
      {
        "groups": [
          {
            "kind": "article",
            "current":  {"mean": 0.82, "sampleSize": 47, "runIds": [str, ...]},
            "baseline": {"mean": 0.88, "sampleSize": 51}
          },
          ...
        ]
      }

    Quality scores come from QAAgent runs — the route tries
    `agent_runs.output->'qa'->>'overall'` first, falling back to the latest
    `agent_events` message from QAAgent (`payload->>'overallScore'`). Runs
    with no extractable score are skipped. `runIds` is capped at 10 per group.
    """
    body: dict = {
        "scope": scope,
        "periodDays": period_days,
        "baselineDays": baseline_days,
    }
    if scope == "user":
        body["userId"] = user_id_opt or ""
    return await post_internal("/sample-quality-scores", body)


@function_tool
async def save_drift_alerts(
    scope: str,
    user_id_opt: str | None,
    alerts: list[dict],
) -> dict:
    """Persist diagnosed PromptDriftAlerts.

    Each alert dict matches the PromptDriftAlert Pydantic shape:
      {scope, agentKind, baselineScore, currentScore, deltaPct, sampleSize,
       diagnosedCause, severity, evidence}

    For scope="global" the persisted user_id is NULL (admin-only RLS).
    For scope="user" it is set to the supplied user_id_opt.

    Returns {"insertedCount": int}.
    """
    body: dict = {
        "scope": scope,
        "runId": get_run_id() or "",
        "alerts": alerts,
    }
    if scope == "user":
        body["userId"] = user_id_opt or ""
    return await post_internal("/save-drift-alerts", body)
