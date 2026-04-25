import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Scope = "global" | "user";

type SampleBody = {
  scope: Scope;
  userId?: string;
  periodDays: number;
  baselineDays: number;
};

type RunRow = {
  id: string;
  kind: string;
  user_id: string;
  created_at: string;
  output: unknown;
};

type EventRow = {
  run_id: string;
  payload: unknown;
};

type GroupAccumulator = {
  current: { sum: number; count: number; runIds: string[] };
  baseline: { sum: number; count: number };
};

type GroupOut = {
  kind: string;
  current: { mean: number; sampleSize: number; runIds: string[] };
  baseline: { mean: number; sampleSize: number };
};

const RUN_ID_CAP = 10;
const MAX_RUNS = 5000;

function isSampleBody(v: unknown): v is SampleBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (r.scope !== "global" && r.scope !== "user") return false;
  if (typeof r.periodDays !== "number" || !Number.isFinite(r.periodDays) || r.periodDays <= 0) {
    return false;
  }
  if (
    typeof r.baselineDays !== "number" ||
    !Number.isFinite(r.baselineDays) ||
    r.baselineDays <= 0
  ) {
    return false;
  }
  if (r.scope === "user") {
    if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  } else if (r.userId !== undefined && typeof r.userId !== "string") {
    return false;
  }
  return true;
}

/** Parse a numeric score from an unknown JSON value. Returns null if unusable. */
function toScore(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Try `output.qa.overall` (and `qa.overallScore` as a tolerant fallback). */
function extractScoreFromOutput(output: unknown): number | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  const qa = o.qa;
  if (!qa || typeof qa !== "object") return null;
  const q = qa as Record<string, unknown>;
  const direct = toScore(q.overall);
  if (direct !== null) return direct;
  return toScore(q.overallScore);
}

/** Try `payload.overallScore` (with `overall` as a fallback). */
function extractScoreFromEventPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const direct = toScore(p.overallScore);
  if (direct !== null) return direct;
  return toScore(p.overall);
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
  if (!isSampleBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const body = parsed;
  const sb = getAdminClient();

  const now = Date.now();
  const currentStart = new Date(now - body.periodDays * 86400_000);
  const baselineStart = new Date(
    now - (body.periodDays + body.baselineDays) * 86400_000,
  );
  const currentStartIso = currentStart.toISOString();
  const baselineStartIso = baselineStart.toISOString();

  let runsQuery = sb
    .from("agent_runs")
    .select("id, kind, user_id, created_at, output")
    .gte("created_at", baselineStartIso)
    .order("created_at", { ascending: false })
    .limit(MAX_RUNS);

  if (body.scope === "user" && body.userId) {
    runsQuery = runsQuery.eq("user_id", body.userId);
  }

  const { data: runsData, error: runsErr } = await runsQuery;
  if (runsErr) {
    return Response.json({ error: "query_failed", detail: runsErr.message }, { status: 500 });
  }

  const runs: RunRow[] = (runsData ?? []) as RunRow[];
  if (runs.length === 0) {
    return Response.json({ groups: [] });
  }

  // First pass — score from output.qa.overall when available.
  const scoreByRun = new Map<string, number>();
  const runsNeedingEventLookup: string[] = [];

  for (const r of runs) {
    const fromOutput = extractScoreFromOutput(r.output);
    if (fromOutput !== null) {
      scoreByRun.set(r.id, fromOutput);
    } else {
      runsNeedingEventLookup.push(r.id);
    }
  }

  // Second pass — fall back to QAAgent message events for runs without an output score.
  if (runsNeedingEventLookup.length > 0) {
    const { data: eventsData } = await sb
      .from("agent_events")
      .select("run_id, payload")
      .in("run_id", runsNeedingEventLookup)
      .eq("kind", "message")
      .eq("agent_name", "QAAgent")
      .order("seq", { ascending: false });

    const events: EventRow[] = (eventsData ?? []) as EventRow[];
    // events come newest-first per run; first hit wins.
    const seen = new Set<string>();
    for (const e of events) {
      if (seen.has(e.run_id)) continue;
      const s = extractScoreFromEventPayload(e.payload);
      if (s !== null) {
        scoreByRun.set(e.run_id, s);
        seen.add(e.run_id);
      }
    }
  }

  // Aggregate by kind, splitting into current vs baseline windows.
  const groups = new Map<string, GroupAccumulator>();

  for (const r of runs) {
    const score = scoreByRun.get(r.id);
    if (score === undefined) continue;

    let g = groups.get(r.kind);
    if (!g) {
      g = {
        current: { sum: 0, count: 0, runIds: [] },
        baseline: { sum: 0, count: 0 },
      };
      groups.set(r.kind, g);
    }

    const isCurrent = r.created_at >= currentStartIso;
    if (isCurrent) {
      g.current.sum += score;
      g.current.count += 1;
      if (g.current.runIds.length < RUN_ID_CAP) g.current.runIds.push(r.id);
    } else {
      g.baseline.sum += score;
      g.baseline.count += 1;
    }
  }

  const out: GroupOut[] = [];
  for (const [kind, g] of groups.entries()) {
    out.push({
      kind,
      current: {
        mean: g.current.count > 0 ? g.current.sum / g.current.count : 0,
        sampleSize: g.current.count,
        runIds: g.current.runIds,
      },
      baseline: {
        mean: g.baseline.count > 0 ? g.baseline.sum / g.baseline.count : 0,
        sampleSize: g.baseline.count,
      },
    });
  }

  return Response.json({ groups: out });
}
