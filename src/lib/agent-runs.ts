import { getAdminClient } from "@/lib/supabase-admin";

export type AgentRun = {
  id: string;
  user_id: string;
  kind: "article" | "autopilot" | "cluster" | "research_only"
      | "refresh" | "audit" | "cluster_plan" | "social_snippet" | "keyword_harvest"
      | "topic_research" | "research_and_write"
      | "competitor_monitor" | "internal_link_optimize" | "schema_doctor" | "content_brief"
      | "seasonal_calendar" | "cannibalization_resolve" | "image_optimize" | "performance_coach"
      | "newsletter_digest" | "social_publish" | "sponsorship_fit"
      | "cost_optimize" | "prompt_drift_detect" | "user_segment";
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  topic: string;
  focus_keyword: string | null;
  tone: string | null;
  target_audience: string | null;
  quality: "standard" | "premium";
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  options: Record<string, unknown>;
  current_step: string | null;
  current_agent: string | null;
  progress_pct: number;
  error: string | null;
  modal_call_id: string | null;
  article_id: string | null;
  autopilot_slot_id: string | null;
  credits_charged: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type AgentEvent = {
  id: number;
  run_id: string;
  seq: number;
  kind: string;
  agent_name: string | null;
  tool_name: string | null;
  message: string | null;
  payload: unknown;
  duration_ms: number | null;
  created_at: string;
};

export async function createAgentRun(params: {
  userId: string;
  kind: AgentRun["kind"];
  topic: string;
  focusKeyword?: string;
  tone?: string;
  targetAudience?: string;
  quality?: AgentRun["quality"];
  input: Record<string, unknown>;
  options?: Record<string, unknown>;
  autopilotSlotId?: string;
}): Promise<AgentRun> {
  const sb = getAdminClient();
  const { data, error } = await sb.from("agent_runs").insert({
    user_id: params.userId,
    kind: params.kind,
    topic: params.topic,
    focus_keyword: params.focusKeyword ?? null,
    tone: params.tone ?? null,
    target_audience: params.targetAudience ?? null,
    quality: params.quality ?? "standard",
    input: params.input,
    options: params.options ?? {},
    autopilot_slot_id: params.autopilotSlotId ?? null,
  }).select().single();
  if (error) throw error;
  return data as AgentRun;
}

export async function getAgentRun(runId: string): Promise<AgentRun | null> {
  const sb = getAdminClient();
  const { data, error } = await sb.from("agent_runs").select("*").eq("id", runId).maybeSingle();
  if (error) throw error;
  return (data as AgentRun | null) ?? null;
}

export async function listAgentRuns(userId: string, limit = 50, beforeCreatedAt?: string): Promise<AgentRun[]> {
  const sb = getAdminClient();
  let query = sb.from("agent_runs")
    .select("*").eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (beforeCreatedAt) {
    query = query.lt("created_at", beforeCreatedAt);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as AgentRun[]) ?? [];
}

export async function listAgentEvents(runId: string, limit = 200): Promise<AgentEvent[]> {
  const sb = getAdminClient();
  const { data, error } = await sb.from("agent_events")
    .select("*").eq("run_id", runId)
    .order("seq", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data as AgentEvent[]) ?? [];
}

export async function insertAgentEvent(params: {
  runId: string;
  seq: number;
  kind: string;
  agentName?: string | null;
  toolName?: string | null;
  message?: string | null;
  payload?: unknown;
  durationMs?: number | null;
}): Promise<void> {
  const sb = getAdminClient();
  const { error } = await sb.from("agent_events").insert({
    run_id: params.runId,
    seq: params.seq,
    kind: params.kind,
    agent_name: params.agentName ?? null,
    tool_name: params.toolName ?? null,
    message: params.message ?? null,
    payload: params.payload ?? null,
    duration_ms: params.durationMs ?? null,
  });
  if (error) throw error;
}

export async function updateAgentRunStatus(params: {
  runId: string;
  status?: AgentRun["status"];
  progressPct?: number;
  currentStep?: string;
  currentAgent?: string;
  error?: string;
  articleId?: string;
  output?: Record<string, unknown>;
  modalCallId?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}): Promise<void> {
  const sb = getAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.status) {
    patch.status = params.status;
    if (params.status === "running") {
      // Set started_at on the FIRST running transition only (when existing row has it null).
      const { data: existing } = await sb
        .from("agent_runs")
        .select("started_at")
        .eq("id", params.runId)
        .maybeSingle();
      const existingStartedAt = (existing as { started_at: string | null } | null)?.started_at ?? null;
      if (existingStartedAt === null) {
        patch.started_at = new Date().toISOString();
      }
    }
    if (["succeeded", "failed", "cancelled"].includes(params.status)) {
      patch.completed_at = new Date().toISOString();
    }
  }
  if (params.progressPct !== undefined) {
    patch.progress_pct = Math.max(0, Math.min(100, Math.round(params.progressPct)));
  }
  if (params.currentStep !== undefined) patch.current_step = params.currentStep;
  if (params.currentAgent !== undefined) patch.current_agent = params.currentAgent;
  if (params.error !== undefined) patch.error = params.error;
  if (params.articleId !== undefined) patch.article_id = params.articleId;
  if (params.output !== undefined) patch.output = params.output;
  if (params.modalCallId !== undefined) patch.modal_call_id = params.modalCallId;
  if (params.tokensIn !== undefined) patch.tokens_in = Math.max(0, Math.round(params.tokensIn));
  if (params.tokensOut !== undefined) patch.tokens_out = Math.max(0, Math.round(params.tokensOut));
  if (params.costUsd !== undefined) patch.cost_usd = Math.max(0, params.costUsd);
  const { error } = await sb.from("agent_runs").update(patch).eq("id", params.runId);
  if (error) throw error;
}

export async function cancelAgentRun(runId: string): Promise<void> {
  const sb = getAdminClient();
  const { error } = await sb.from("agent_runs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", runId)
    .in("status", ["pending", "running"]);
  if (error) throw error;
}
