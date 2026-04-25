import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ALLOWED_REC_KINDS = new Set([
  "downgrade_model",
  "reduce_image_count",
  "skip_qa_short",
  "disable_writer_fanout",
  "increase_dedup_threshold",
  "cache_research",
  "throttle_autonomous",
  "other",
]);

type RecommendationInput = {
  kind: string;
  change: string;
  estimatedSavingsUsd: number;
  reason: string;
};

type ReportInput = {
  periodStart: string;
  periodEnd: string;
  totalCostUsd: number;
  totalRuns: number;
  costByKind: Record<string, number>;
  recommendations: RecommendationInput[];
};

type SaveBody = {
  userId: string;
  runId: string | null;
  report: ReportInput;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function isCostByKind(v: unknown): v is Record<string, number> {
  if (!v || typeof v !== "object") return false;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof k !== "string") return false;
    if (!isFiniteNumber(val)) return false;
  }
  return true;
}

function isRecommendation(v: unknown): v is RecommendationInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.kind !== "string" || !ALLOWED_REC_KINDS.has(r.kind)) return false;
  if (!isNonEmptyString(r.change)) return false;
  if (!isFiniteNumber(r.estimatedSavingsUsd)) return false;
  if (typeof r.reason !== "string") return false;
  return true;
}

function isReport(v: unknown): v is ReportInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (!isNonEmptyString(r.periodStart)) return false;
  if (!isNonEmptyString(r.periodEnd)) return false;
  if (!isFiniteNumber(r.totalCostUsd)) return false;
  if (!isFiniteNumber(r.totalRuns) || !Number.isInteger(r.totalRuns)) return false;
  if (!isCostByKind(r.costByKind)) return false;
  if (!Array.isArray(r.recommendations)) return false;
  for (const rec of r.recommendations) if (!isRecommendation(rec)) return false;
  return true;
}

function isSaveBody(v: unknown): v is SaveBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (!isNonEmptyString(r.userId)) return false;
  if (r.runId !== null && typeof r.runId !== "string") return false;
  if (!isReport(r.report)) return false;
  return true;
}

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(auth.rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isSaveBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const body = parsed;
  const runId =
    body.runId === null || body.runId.trim() === "" ? null : body.runId.trim();
  const report = body.report;

  // Persist recommendations as a JSONB array using snake_case keys so the
  // browser-side code can consume the payload without an extra
  // transformation step.
  const recommendations = report.recommendations.map((r) => ({
    kind: r.kind,
    change: r.change,
    estimated_savings_usd: r.estimatedSavingsUsd,
    reason: r.reason,
  }));

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("cost_optimization_reports")
    .insert({
      user_id: body.userId,
      run_id: runId,
      period_start: report.periodStart,
      period_end: report.periodEnd,
      total_cost_usd: report.totalCostUsd,
      total_runs: report.totalRuns,
      cost_by_kind: report.costByKind,
      recommendations,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    return Response.json(
      { error: "insert_failed", detail: error?.message ?? "no_id" },
      { status: 500 },
    );
  }

  return Response.json({ reportId: data.id });
}
