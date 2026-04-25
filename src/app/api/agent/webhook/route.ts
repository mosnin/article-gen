import { NextResponse } from "next/server";
import { requireWebhookAuth } from "@/lib/agent-auth";
import { insertAgentEvent, updateAgentRunStatus } from "@/lib/agent-runs";
import { releaseGenerationSlot } from "@/lib/rate-limit";
import { getAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

type WebhookBody = {
  runId: string;
  seq: number;
  kind: string;
  agentName?: string | null;
  toolName?: string | null;
  message?: string | null;
  payload?: unknown;
  durationMs?: number | null;
  statusUpdate?: {
    status?: "running" | "succeeded" | "failed" | "cancelled";
    progressPct?: number;
    currentStep?: string;
    currentAgent?: string;
    error?: string;
    articleId?: string;
    output?: Record<string, unknown>;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
  };
  at?: string;
};

const ALLOWED_KINDS = new Set([
  "run_started",
  "run_completed",
  "run_failed",
  "agent_started",
  "agent_ended",
  "tool_started",
  "tool_ended",
  "message",
  "handoff",
  "progress",
  "warning",
]);

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

export async function POST(req: Request) {
  const auth = await requireWebhookAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(auth.rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.runId || body.runId !== auth.runId) {
    return NextResponse.json({ error: "Run ID mismatch" }, { status: 400 });
  }
  if (!ALLOWED_KINDS.has(body.kind)) {
    return NextResponse.json({ error: "Invalid event kind" }, { status: 400 });
  }
  if (typeof body.seq !== "number" || body.seq < 1) {
    return NextResponse.json({ error: "Invalid seq" }, { status: 400 });
  }

  try {
    await insertAgentEvent({
      runId: body.runId,
      seq: body.seq,
      kind: body.kind,
      agentName: body.agentName,
      toolName: body.toolName,
      message: body.message,
      payload: body.payload,
      durationMs: body.durationMs,
    });
  } catch (error: unknown) {
    // Duplicate seq is not fatal — webhook retries can arrive.
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.toLowerCase().includes("duplicate")) {
      logger.error("Failed to insert agent event", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
  }

  if (body.statusUpdate) {
    // Terminal-state guard: once a run is cancelled / succeeded / failed, do
    // not let a late event from Modal flip it back. The event itself is still
    // recorded above so the timeline is faithful — only the status mutation
    // is suppressed.
    let suppressStatusMutation = false;
    try {
      const { data: existing } = await getAdminClient()
        .from("agent_runs")
        .select("status")
        .eq("id", body.runId)
        .single();
      const existingStatus = (existing as { status?: string } | null)?.status;
      if (
        existingStatus &&
        TERMINAL_STATUSES.has(existingStatus) &&
        existingStatus !== body.statusUpdate.status
      ) {
        suppressStatusMutation = true;
        logger.error(
          `[webhook] suppressing late status mutation: run=${body.runId} ` +
            `existing=${existingStatus} incoming=${body.statusUpdate.status ?? "none"}`,
        );
      }
    } catch (error: unknown) {
      logger.error("Failed to read existing run status", error);
    }

    try {
      if (!suppressStatusMutation) {
        await updateAgentRunStatus({
          runId: body.runId,
          status: body.statusUpdate.status,
          progressPct: body.statusUpdate.progressPct,
          currentStep: body.statusUpdate.currentStep,
          currentAgent: body.statusUpdate.currentAgent,
          error: body.statusUpdate.error,
          articleId: body.statusUpdate.articleId,
          output: body.statusUpdate.output,
          tokensIn: body.statusUpdate.tokensIn,
          tokensOut: body.statusUpdate.tokensOut,
          costUsd: body.statusUpdate.costUsd,
        });
      }
    } catch (error: unknown) {
      logger.error("Failed to update agent run status", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    // Release the rate-limit slot when the run terminates.
    if (body.statusUpdate.status && TERMINAL_STATUSES.has(body.statusUpdate.status)) {
      try {
        const sb = getAdminClient();
        const { data } = await sb
          .from("agent_runs")
          .select("user_id")
          .eq("id", body.runId)
          .maybeSingle();
        if (data?.user_id) {
          await releaseGenerationSlot(sb, data.user_id);
        }
      } catch (error: unknown) {
        logger.error("Failed to release generation slot on terminal status", error);
      }
    }

    // Autopilot slot-done bookkeeping (audit G-1): when a run linked to an
    // autopilot slot succeeds, mark that slot as `done` in the user's
    // `autopilot_plan`. Best-effort — failures are logged but do not fail the
    // webhook.
    if (body.statusUpdate.status === "succeeded") {
      try {
        const admin = getAdminClient();
        const { data: run } = await admin
          .from("agent_runs")
          .select("autopilot_slot_id, article_id, user_id")
          .eq("id", body.runId)
          .single();
        if (run?.autopilot_slot_id && run.user_id) {
          const { data: settings } = await admin
            .from("user_settings")
            .select("autopilot_plan")
            .eq("user_id", run.user_id)
            .single();
          const rawPlan = (settings as { autopilot_plan?: unknown } | null)?.autopilot_plan;
          const plan: Array<Record<string, unknown>> = Array.isArray(rawPlan)
            ? (rawPlan as Array<Record<string, unknown>>)
            : [];
          const nextPlan = plan.map((slot) =>
            slot && slot.id === run.autopilot_slot_id
              ? {
                  ...slot,
                  status: "done",
                  articleId: run.article_id,
                  completedAt: new Date().toISOString(),
                }
              : slot,
          );
          await admin
            .from("user_settings")
            .update({ autopilot_plan: nextPlan })
            .eq("user_id", run.user_id);
        }
      } catch (e) {
        logger.error("[webhook] slot-done bookkeeping failed", e);
        // best-effort: do not fail the webhook
      }
    }
  }

  return NextResponse.json({ ok: true });
}
