import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Scope = "global" | "user";
type Severity = "low" | "medium" | "high" | "critical";
type DiagnosedCause =
  | "model_snapshot_change"
  | "prompt_edit"
  | "data_drift"
  | "unknown";

type AlertInput = {
  agentKind: string;
  baselineScore: number;
  currentScore: number;
  deltaPct: number;
  sampleSize: number;
  diagnosedCause?: DiagnosedCause | null;
  severity: Severity;
  evidence?: unknown[];
};

type SaveBody = {
  scope: Scope;
  userId?: string;
  runId: string;
  alerts: AlertInput[];
};

const SEVERITIES: ReadonlySet<Severity> = new Set(["low", "medium", "high", "critical"]);
const CAUSES: ReadonlySet<DiagnosedCause> = new Set([
  "model_snapshot_change",
  "prompt_edit",
  "data_drift",
  "unknown",
]);

function isAlert(v: unknown): v is AlertInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.agentKind !== "string" || r.agentKind.trim() === "") return false;
  if (typeof r.baselineScore !== "number" || Number.isNaN(r.baselineScore)) return false;
  if (typeof r.currentScore !== "number" || Number.isNaN(r.currentScore)) return false;
  if (typeof r.deltaPct !== "number" || Number.isNaN(r.deltaPct)) return false;
  if (typeof r.sampleSize !== "number" || !Number.isFinite(r.sampleSize)) return false;
  if (typeof r.severity !== "string" || !SEVERITIES.has(r.severity as Severity)) return false;
  if (
    r.diagnosedCause !== undefined &&
    r.diagnosedCause !== null &&
    (typeof r.diagnosedCause !== "string" ||
      !CAUSES.has(r.diagnosedCause as DiagnosedCause))
  ) {
    return false;
  }
  if (r.evidence !== undefined && !Array.isArray(r.evidence)) return false;
  return true;
}

function isSaveBody(v: unknown): v is SaveBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (r.scope !== "global" && r.scope !== "user") return false;
  if (r.scope === "user") {
    if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  } else if (r.userId !== undefined && typeof r.userId !== "string") {
    return false;
  }
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
  const userId = body.scope === "user" ? body.userId ?? null : null;

  const sb = getAdminClient();
  let insertedCount = 0;

  for (const a of body.alerts) {
    const { error } = await sb.from("prompt_drift_alerts").insert({
      user_id: userId,
      run_id: runId,
      scope: body.scope,
      agent_kind: a.agentKind,
      baseline_score: a.baselineScore,
      current_score: a.currentScore,
      delta_pct: a.deltaPct,
      sample_size: a.sampleSize,
      diagnosed_cause: a.diagnosedCause ?? null,
      severity: a.severity,
      evidence: Array.isArray(a.evidence) ? a.evidence : [],
      status: "pending",
    });
    if (error) continue;
    insertedCount += 1;
  }

  return Response.json({ insertedCount });
}
