import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type MetricName = "clicks" | "impressions" | "position" | "ctr";
type Severity = "low" | "medium" | "high" | "critical";
type RecommendedKind =
  | "refresh"
  | "rewrite"
  | "archive"
  | "add_internal_links"
  | "add_schema"
  | "no_action";

type AlertInput = {
  articleId: string;
  metricName: MetricName;
  periodDays?: number;
  baselineValue: number;
  currentValue: number;
  changePct: number;
  severity: Severity;
  diagnosedCause?: string | null;
  recommendedKind?: RecommendedKind | null;
  rationale?: string;
};

type SaveBody = {
  userId: string;
  runId: string;
  alerts: AlertInput[];
};

const METRIC_NAMES: ReadonlySet<MetricName> = new Set([
  "clicks",
  "impressions",
  "position",
  "ctr",
]);
const SEVERITIES: ReadonlySet<Severity> = new Set(["low", "medium", "high", "critical"]);
const RECOMMENDED_KINDS: ReadonlySet<RecommendedKind> = new Set([
  "refresh",
  "rewrite",
  "archive",
  "add_internal_links",
  "add_schema",
  "no_action",
]);

function isAlert(v: unknown): v is AlertInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.articleId !== "string" || r.articleId.trim() === "") return false;
  if (typeof r.metricName !== "string" || !METRIC_NAMES.has(r.metricName as MetricName)) {
    return false;
  }
  if (r.periodDays !== undefined && typeof r.periodDays !== "number") return false;
  if (typeof r.baselineValue !== "number" || Number.isNaN(r.baselineValue)) return false;
  if (typeof r.currentValue !== "number" || Number.isNaN(r.currentValue)) return false;
  if (typeof r.changePct !== "number" || Number.isNaN(r.changePct)) return false;
  if (typeof r.severity !== "string" || !SEVERITIES.has(r.severity as Severity)) return false;
  if (
    r.diagnosedCause !== undefined &&
    r.diagnosedCause !== null &&
    typeof r.diagnosedCause !== "string"
  ) {
    return false;
  }
  if (
    r.recommendedKind !== undefined &&
    r.recommendedKind !== null &&
    (typeof r.recommendedKind !== "string" ||
      !RECOMMENDED_KINDS.has(r.recommendedKind as RecommendedKind))
  ) {
    return false;
  }
  if (r.rationale !== undefined && typeof r.rationale !== "string") return false;
  return true;
}

function isSaveBody(v: unknown): v is SaveBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (typeof r.runId !== "string") return false;
  if (!Array.isArray(r.alerts)) return false;
  for (const a of r.alerts) if (!isAlert(a)) return false;
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
  const runId = body.runId.trim() === "" ? null : body.runId;

  const sb = getAdminClient();
  let insertedCount = 0;

  for (const a of body.alerts) {
    const { error } = await sb.from("performance_alerts").insert({
      user_id: body.userId,
      run_id: runId,
      article_id: a.articleId,
      metric_name: a.metricName,
      period_days: typeof a.periodDays === "number" ? a.periodDays : 30,
      baseline_value: a.baselineValue,
      current_value: a.currentValue,
      change_pct: a.changePct,
      severity: a.severity,
      diagnosed_cause: a.diagnosedCause ?? null,
      recommended_kind: a.recommendedKind ?? null,
      rationale: a.rationale ?? "",
      status: "pending",
    });
    if (error) continue;
    insertedCount += 1;
  }

  return Response.json({ insertedCount });
}
