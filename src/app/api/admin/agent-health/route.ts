import { NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase-server";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

type RunRow = {
  id: string;
  status: RunStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  cost_usd: number | string | null;
  tokens_in: number | string | null;
  tokens_out: number | string | null;
  error: string | null;
  topic: string;
  updated_at: string | null;
};

type EventRow = {
  tool_name: string | null;
  agent_name: string | null;
};

type HealthSummary = {
  window: "24h" | "7d";
  runs: { pending: number; running: number; succeeded: number; failed: number; cancelled: number };
  totals: {
    totalRuns: number;
    succeededRuns: number;
    failedRuns: number;
    avgDurationMs: number | null;
    p95DurationMs: number | null;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCostUsd: number;
  };
  stuckRunsCount: number;
  topFailingTools: Array<{ toolName: string; errorCount: number }>;
  topFailingAgents: Array<{ agentName: string; errorCount: number }>;
  recentFailures: Array<{ id: string; topic: string; error: string | null; created_at: string }>;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const windowParam: "24h" | "7d" = url.searchParams.get("window") === "7d" ? "7d" : "24h";

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const hours = windowParam === "7d" ? 24 * 7 : 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: runsData } = await admin
    .from("agent_runs")
    .select("id, status, created_at, started_at, completed_at, cost_usd, tokens_in, tokens_out, error, topic, updated_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  const runs: RunRow[] = (runsData ?? []) as RunRow[];

  const byStatus: { pending: number; running: number; succeeded: number; failed: number; cancelled: number } = {
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
  };
  let totalCost = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const durations: number[] = [];

  for (const r of runs) {
    if (r.status in byStatus) {
      byStatus[r.status] = byStatus[r.status] + 1;
    }
    totalCost += Number(r.cost_usd ?? 0);
    totalTokensIn += Number(r.tokens_in ?? 0);
    totalTokensOut += Number(r.tokens_out ?? 0);
    if (r.started_at && r.completed_at) {
      durations.push(new Date(r.completed_at).getTime() - new Date(r.started_at).getTime());
    }
  }

  durations.sort((a, b) => a - b);
  const avg = durations.length
    ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
    : null;
  const p95 = durations.length
    ? durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)]
    : null;

  // Stuck: status=running, updated_at older than 10min — NOT restricted to the window
  const stuckThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: stuckCount } = await admin
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("status", "running")
    .lt("updated_at", stuckThreshold);

  // Top failing tools — tool_ended events with a non-null message are error rows (see progress.py:170)
  const { data: toolErrorsData } = await admin
    .from("agent_events")
    .select("tool_name, agent_name")
    .eq("kind", "tool_ended")
    .not("message", "is", null)
    .gte("created_at", since)
    .limit(5000);

  const toolErrors: EventRow[] = (toolErrorsData ?? []) as EventRow[];

  const toolCounts = new Map<string, number>();
  const agentCounts = new Map<string, number>();
  for (const e of toolErrors) {
    if (e.tool_name) toolCounts.set(e.tool_name, (toolCounts.get(e.tool_name) ?? 0) + 1);
    if (e.agent_name) agentCounts.set(e.agent_name, (agentCounts.get(e.agent_name) ?? 0) + 1);
  }
  const topFailingTools = [...toolCounts.entries()]
    .map(([toolName, errorCount]) => ({ toolName, errorCount }))
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 5);
  const topFailingAgents = [...agentCounts.entries()]
    .map(([agentName, errorCount]) => ({ agentName, errorCount }))
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 5);

  const recentFailures = runs
    .filter((r) => r.status === "failed")
    .slice(0, 10)
    .map((r) => ({ id: r.id, topic: r.topic, error: r.error, created_at: r.created_at }));

  const summary: HealthSummary = {
    window: windowParam,
    runs: byStatus,
    totals: {
      totalRuns: runs.length,
      succeededRuns: byStatus.succeeded,
      failedRuns: byStatus.failed,
      avgDurationMs: avg,
      p95DurationMs: p95,
      totalTokensIn,
      totalTokensOut,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
    },
    stuckRunsCount: stuckCount ?? 0,
    topFailingTools,
    topFailingAgents,
    recentFailures,
  };

  return NextResponse.json(summary);
}
