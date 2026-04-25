"""CostOptimizer tools — agent-run cost aggregation + report persistence.

`summarize_run_cost` POSTs `/api/internal/summarize-run-cost` to retrieve
the user's per-kind spend AND the per-kind decided-action rate so the
agent can reason about value-per-dollar (high spend on a kind whose
output is rarely acted on is the prime cost-cut target).

`save_cost_optimization_report` persists the agent's
`CostOptimizationReport` JSON via
`/api/internal/save-cost-optimization-report`. Both routes mirror the
HMAC + bearer-auth pattern used by the rest of the harness tools.
"""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def summarize_run_cost(user_id: str, period_days: int = 30) -> dict:
    """Aggregate this user's agent-run cost over the last `period_days` days.

    Returns a structure shaped like::

      {
        "periodStart": ISO8601,
        "periodEnd":   ISO8601,
        "totalCostUsd": float,
        "totalRuns":    int,
        "costByKind":   {kind: usd, ...},
        "perKind": [
          {
            "kind": str,
            "runs": int,
            "totalUsd": float,
            "avgUsd":   float,
            "succeededRuns": int,
            "failedRuns":    int,
            "decidedActionTaken": float   # 0..1, share of follow-up
                                          # rows for this kind whose status
                                          # is no longer 'pending'/'discovered'
                                          # (or null if the kind has no
                                          # follow-up table)
          },
          ...
        ]
      }

    The `decidedActionTaken` field lets the agent tell apart "expensive
    AND ignored" (cut spend) from "expensive AND acted on" (worth it).
    """
    return await post_internal(
        "/summarize-run-cost",
        {"userId": user_id, "periodDays": int(period_days)},
    )


@function_tool
async def save_cost_optimization_report(user_id: str, report: dict) -> dict:
    """Persist the diagnosed CostOptimizationReport.

    The `report` dict matches the CostOptimizationReport Pydantic shape:
      {
        "periodStart", "periodEnd",
        "totalCostUsd", "totalRuns",
        "costByKind": {kind: usd},
        "recommendations": [
          {"kind", "change", "estimatedSavingsUsd", "reason"},
          ...
        ]
      }

    Returns ``{"reportId": str}``.
    """
    return await post_internal(
        "/save-cost-optimization-report",
        {"userId": user_id, "runId": get_run_id(), "report": report},
    )


__all__ = ["summarize_run_cost", "save_cost_optimization_report"]
