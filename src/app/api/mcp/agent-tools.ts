import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import crypto from "crypto";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { checkCredits } from "@/lib/credits";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";
import { createAgentRun, updateAgentRunStatus, cancelAgentRun, listAgentRuns, listAgentEvents } from "@/lib/agent-runs";
import { triggerAgentRun, type ModalTriggerPayload } from "@/lib/modal-client";
import { logger } from "@/lib/logger";
import { defineTool, jsonResult, errorResult } from "@/lib/mcp/context";
import type { McpAuth } from "@/lib/mcp/auth";

/** Agent task kinds an MCP client may dispatch. Deliberately excludes
 *  internal/ops kinds (cost_optimize, prompt_drift_detect, user_segment,
 *  autopilot) — those run through their own scheduled surfaces. */
const DISPATCHABLE_KINDS = [
  "article",
  "research_only",
  "refresh",
  "audit",
  "topic_research",
  "research_and_write",
  "content_brief",
  "keyword_harvest",
  "competitor_monitor",
  "internal_link_optimize",
  "schema_doctor",
  "seasonal_calendar",
  "cannibalization_resolve",
  "image_optimize",
  "performance_coach",
] as const;

async function dispatchRun(
  auth: McpAuth,
  params: {
    kind: ModalTriggerPayload["kind"];
    topic: string;
    focusKeyword?: string;
    tone?: string;
    targetAudience?: string;
    quality: "standard" | "premium";
    articleId?: string;
    options?: Record<string, unknown>;
  },
) {
  const admin = getAdminClient();
  const creditsNeeded = params.quality === "premium" ? 3 : 1;

  const creditCheck = await checkCredits(admin, auth.userId, creditsNeeded);
  if (!creditCheck.allowed) {
    return errorResult("Insufficient credits. Upgrade the plan or wait for the monthly reset.");
  }

  const slotAcquired = await acquireGenerationSlot(admin, auth.userId);
  if (!slotAcquired) {
    return errorResult("Too many concurrent generations (max 5). Wait for a run to finish.");
  }

  let run;
  try {
    run = await createAgentRun({
      userId: auth.userId,
      kind: params.kind as "article",
      topic: params.topic,
      focusKeyword: params.focusKeyword,
      tone: params.tone,
      targetAudience: params.targetAudience,
      quality: params.quality,
      input: { ...params, dispatchedVia: "mcp" } as Record<string, unknown>,
      options: params.options ?? {},
    });
  } catch (error) {
    logger.error("mcp: failed to create agent run", error);
    await releaseGenerationSlot(admin, auth.userId);
    return errorResult("Failed to create run");
  }

  try {
    const trigger = await triggerAgentRun({
      runId: run.id,
      userId: auth.userId,
      kind: params.kind,
      topic: params.topic,
      focusKeyword: params.focusKeyword,
      tone: params.tone,
      targetAudience: params.targetAudience,
      quality: params.quality,
      options: params.options ?? {},
      articleId: params.articleId,
    });
    await updateAgentRunStatus({ runId: run.id, modalCallId: trigger.modalCallId });
    return jsonResult({ runId: run.id, status: "pending", kind: params.kind });
  } catch (error) {
    logger.error("mcp: failed to trigger agent run", error);
    await updateAgentRunStatus({
      runId: run.id,
      status: "failed",
      error: error instanceof Error ? error.message : "trigger_failed",
    });
    await releaseGenerationSlot(admin, auth.userId);
    return errorResult("Failed to trigger the agent backend");
  }
}

/** Load a run and verify ownership before exposing or mutating it. */
async function getOwnedRun(auth: McpAuth, runId: string) {
  const admin = getAdminClient();
  const { data } = await admin
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  return data;
}

export function registerAgentTools(server: McpServer, auth: McpAuth) {
  defineTool(server, auth, {
    name: "generate_article",
    description:
      "Generate a full SEO article via the agent pipeline. Costs 1 credit (standard) or 3 (premium). Returns a runId to poll with get_agent_run.",
    scope: "generate",
    schema: {
      topic: z.string().min(1).max(300),
      focus_keyword: z.string().max(150).optional(),
      tone: z.string().max(100).optional(),
      target_audience: z.string().max(100).optional(),
      quality: z.enum(["standard", "premium"]).default("standard"),
      image_count: z.number().int().min(0).max(4).optional(),
      auto_publish: z.boolean().optional().describe("Publish automatically to connected platforms when done"),
    },
    handler: async ({ topic, focus_keyword, tone, target_audience, quality, image_count, auto_publish }) =>
      dispatchRun(auth, {
        kind: "article",
        topic,
        focusKeyword: focus_keyword,
        tone,
        targetAudience: target_audience,
        quality,
        options: {
          ...(image_count !== undefined ? { imageCount: image_count } : {}),
          ...(auto_publish !== undefined ? { autoPublish: auto_publish } : {}),
        },
      }),
  });

  defineTool(server, auth, {
    name: "run_agent_task",
    description:
      `Dispatch a non-article agent task. Kinds: ${DISPATCHABLE_KINDS.filter((k) => k !== "article").join(", ")}. Costs 1 credit. Returns a runId.`,
    scope: "generate",
    schema: {
      kind: z.enum(DISPATCHABLE_KINDS),
      topic: z.string().min(1).max(300).describe("Subject or instruction for the task"),
      article_id: z.string().uuid().optional().describe("Target article for refresh/audit/image_optimize tasks"),
      quality: z.enum(["standard", "premium"]).default("standard"),
    },
    handler: async ({ kind, topic, article_id, quality }) =>
      dispatchRun(auth, { kind, topic, quality, articleId: article_id }),
  });

  defineTool(server, auth, {
    name: "get_agent_run",
    description: "Get status, progress, cost, and output of an agent run, with its most recent events.",
    scope: "read",
    schema: {
      run_id: z.string().uuid(),
      include_events: z.boolean().default(false),
      event_limit: z.number().int().min(1).max(100).default(20),
    },
    handler: async ({ run_id, include_events, event_limit }) => {
      const run = await getOwnedRun(auth, run_id);
      if (!run) return errorResult("Run not found");
      const events = include_events ? (await listAgentEvents(run_id, event_limit)) : undefined;
      return jsonResult({
        id: run.id,
        kind: run.kind,
        status: run.status,
        topic: run.topic,
        progressPct: run.progress_pct,
        currentStep: run.current_step,
        currentAgent: run.current_agent,
        error: run.error,
        articleId: run.article_id,
        creditsCharged: run.credits_charged,
        costUsd: run.cost_usd,
        createdAt: run.created_at,
        completedAt: run.completed_at,
        output: run.output,
        ...(events ? { events: events.map((e) => ({ seq: e.seq, kind: e.kind, agent: e.agent_name, tool: e.tool_name, message: e.message, at: e.created_at })) } : {}),
      });
    },
  });

  defineTool(server, auth, {
    name: "list_agent_runs",
    description: "List recent agent runs (newest first).",
    scope: "read",
    schema: {
      limit: z.number().int().min(1).max(100).default(20),
      status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]).optional(),
    },
    handler: async ({ limit, status }) => {
      let runs = await listAgentRuns(auth.userId, Math.min(limit * 2, 200));
      if (status) runs = runs.filter((r) => r.status === status);
      return jsonResult(
        runs.slice(0, limit).map((r) => ({
          id: r.id,
          kind: r.kind,
          status: r.status,
          topic: r.topic,
          progressPct: r.progress_pct,
          articleId: r.article_id,
          costUsd: r.cost_usd,
          createdAt: r.created_at,
          completedAt: r.completed_at,
        })),
      );
    },
  });

  defineTool(server, auth, {
    name: "cancel_agent_run",
    description: "Cancel a pending or running agent run.",
    scope: "generate",
    schema: { run_id: z.string().uuid() },
    handler: async ({ run_id }) => {
      const run = await getOwnedRun(auth, run_id);
      if (!run) return errorResult("Run not found");
      if (!["pending", "running"].includes(run.status as string)) {
        return errorResult(`Run is already ${run.status} and cannot be cancelled`);
      }

      // Best-effort Modal cancel, same contract as the dashboard cancel route.
      const cancelUrl = process.env.MODAL_AGENT_CANCEL_URL;
      const token = process.env.MODAL_AGENT_TOKEN;
      if (run.modal_call_id && cancelUrl && token) {
        const body = JSON.stringify({ modalCallId: run.modal_call_id });
        const sig = "sha256=" + crypto.createHmac("sha256", token).update(body).digest("hex");
        await fetch(cancelUrl, {
          method: "POST",
          headers: { "content-type": "application/json", "x-signature": sig },
          body,
        }).catch((err) => logger.error("mcp: modal cancel POST failed", err));
      }

      await cancelAgentRun(run_id);
      return jsonResult({ cancelled: true, runId: run_id });
    },
  });
}
