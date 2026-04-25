import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type SummarizeBody = {
  userId: string;
  periodDays: number;
};

type AgentRunRow = {
  id: string;
  kind: string | null;
  status: string | null;
  cost_usd: number | string | null;
  created_at: string;
};

type FollowUpRow = {
  run_id: string | null;
  status?: string | null;
  decided_action?: string | null;
};

type PerKindEntry = {
  kind: string;
  runs: number;
  totalUsd: number;
  avgUsd: number;
  succeededRuns: number;
  failedRuns: number;
  decidedActionTaken: number | null;
};

type SummarizeResponse = {
  periodStart: string;
  periodEnd: string;
  totalCostUsd: number;
  totalRuns: number;
  costByKind: Record<string, number>;
  perKind: PerKindEntry[];
};

const MAX_PERIOD_DAYS = 180;
const MIN_PERIOD_DAYS = 1;

function isSummarizeBody(v: unknown): v is SummarizeBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (typeof r.periodDays !== "number" || !Number.isFinite(r.periodDays)) return false;
  return true;
}

function toNumber(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Map of agent_runs.kind -> follow-up table description used to compute
 * `decidedActionTaken` (= share of follow-up rows whose status column is
 * no longer the default pending/discovered value).
 *
 * Kinds NOT in this map (refresh, social_publish, social_snippet,
 * newsletter_digest, image_optimize where the action goes back into
 * articles, etc.) are reported with `decidedActionTaken: null` so the
 * agent treats them as "no value-tracking signal available" and does
 * not down-rank them on a missing signal.
 */
const FOLLOW_UP_TABLES: Record<
  string,
  { table: string; statusColumn: "status" | "decided_action"; pendingValues: string[] }
> = {
  audit: {
    table: "article_audits",
    statusColumn: "decided_action",
    pendingValues: ["pending"],
  },
  topic_research: {
    table: "topic_proposals",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  keyword_harvest: {
    table: "keyword_candidates",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  content_brief: {
    table: "content_briefs",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  competitor_monitor: {
    table: "competitor_articles",
    statusColumn: "status",
    pendingValues: ["discovered"],
  },
  internal_link_optimize: {
    table: "link_suggestions",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  schema_doctor: {
    table: "schema_diagnoses",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  seasonal_calendar: {
    table: "seasonal_recommendations",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  cannibalization_resolve: {
    table: "cannibalization_resolutions",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  image_optimize: {
    table: "image_optimization_recommendations",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  performance_coach: {
    table: "performance_alerts",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  sponsorship_fit: {
    table: "sponsor_fits",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
  cluster_plan: {
    // Cluster plans have no decision table per se; we treat any cluster
    // whose strategy_plan was last_planned_at >= periodStart as "decided"
    // in absence of a per-row status. Falls through to null below since
    // its statusColumn is not on `clusters`.
    table: "clusters",
    statusColumn: "status",
    pendingValues: ["pending"],
  },
};

async function computeDecidedRate(
  sb: ReturnType<typeof getAdminClient>,
  userId: string,
  kind: string,
  runIds: string[],
): Promise<number | null> {
  const cfg = FOLLOW_UP_TABLES[kind];
  if (!cfg) return null;
  if (runIds.length === 0) return null;

  // `clusters` table doesn't have a per-row decided status, so skip.
  if (cfg.table === "clusters") return null;

  const { data, error } = await sb
    .from(cfg.table)
    .select(`run_id, ${cfg.statusColumn}`)
    .eq("user_id", userId)
    .in("run_id", runIds);
  if (error || !data) return null;

  const rows = data as unknown as FollowUpRow[];
  if (rows.length === 0) return null;

  const pending = new Set(cfg.pendingValues);
  let acted = 0;
  for (const row of rows) {
    const v = (cfg.statusColumn === "status" ? row.status : row.decided_action) ?? null;
    if (v !== null && !pending.has(v)) acted += 1;
  }
  return rows.length > 0 ? acted / rows.length : null;
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
  if (!isSummarizeBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const body = parsed;
  const periodDays = Math.min(
    MAX_PERIOD_DAYS,
    Math.max(MIN_PERIOD_DAYS, Math.floor(body.periodDays)),
  );

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const sb = getAdminClient();

  // 1) Pull all agent_runs in the window for this user.
  const { data: runs, error: runsErr } = await sb
    .from("agent_runs")
    .select("id, kind, status, cost_usd, created_at")
    .eq("user_id", body.userId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  if (runsErr) {
    return Response.json(
      { error: "query_failed", detail: runsErr.message },
      { status: 500 },
    );
  }

  const rows = (runs ?? []) as AgentRunRow[];

  // 2) Aggregate in JS — total cost/runs + costByKind + perKind buckets.
  type Bucket = {
    runs: number;
    totalUsd: number;
    succeededRuns: number;
    failedRuns: number;
    runIds: string[];
  };
  const byKind: Map<string, Bucket> = new Map();
  let totalCostUsd = 0;
  let totalRuns = 0;

  for (const r of rows) {
    const kind = (r.kind ?? "unknown").trim() || "unknown";
    const cost = toNumber(r.cost_usd);
    totalCostUsd += cost;
    totalRuns += 1;

    let bucket = byKind.get(kind);
    if (!bucket) {
      bucket = {
        runs: 0,
        totalUsd: 0,
        succeededRuns: 0,
        failedRuns: 0,
        runIds: [],
      };
      byKind.set(kind, bucket);
    }
    bucket.runs += 1;
    bucket.totalUsd += cost;
    if (r.status === "succeeded") bucket.succeededRuns += 1;
    else if (r.status === "failed") bucket.failedRuns += 1;
    bucket.runIds.push(r.id);
  }

  // 3) Compute decidedActionTaken per kind by joining its follow-up
  // table in parallel.
  const kinds = Array.from(byKind.keys());
  const decidedRates = await Promise.all(
    kinds.map((k) => computeDecidedRate(sb, body.userId, k, byKind.get(k)?.runIds ?? [])),
  );

  // 4) Shape the response.
  const costByKind: Record<string, number> = {};
  const perKind: PerKindEntry[] = [];
  kinds.forEach((kind, idx) => {
    const b = byKind.get(kind);
    if (!b) return;
    costByKind[kind] = round4(b.totalUsd);
    perKind.push({
      kind,
      runs: b.runs,
      totalUsd: round4(b.totalUsd),
      avgUsd: b.runs > 0 ? round4(b.totalUsd / b.runs) : 0,
      succeededRuns: b.succeededRuns,
      failedRuns: b.failedRuns,
      decidedActionTaken: decidedRates[idx],
    });
  });

  // Sort perKind by spend desc so the agent sees the worst offenders first.
  perKind.sort((a, b) => b.totalUsd - a.totalUsd);

  const response: SummarizeResponse = {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalCostUsd: round4(totalCostUsd),
    totalRuns,
    costByKind,
    perKind,
  };

  return Response.json(response);
}
