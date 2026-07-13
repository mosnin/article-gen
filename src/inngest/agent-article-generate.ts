import { inngest } from "@/lib/inngest";
import { triggerAgentRun } from "@/lib/modal-client";
import {
  createAgentRun,
  updateAgentRunStatus,
  getAgentRun,
} from "@/lib/agent-runs";
import { getAdminClient } from "@/lib/supabase-admin";

export const agentArticleGenerate = inngest.createFunction(
  {
    id: "agent-article-generate",
    name: "Agent: generate article",
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: "agent/article.generate" }],
  },
  async ({ event, step }) => {
    const input = event.data;
    if (!input?.userId || !input?.topic) {
      throw new Error(
        "agent/article.generate: userId and topic are required"
      );
    }

    const run = await step.run("ensure-agent-run", async () => {
      if (input.runId) {
        const existing = await getAgentRun(input.runId);
        if (existing) return existing;
      }
      return createAgentRun({
        userId: input.userId,
        kind: input.kind ?? "article",
        topic: input.topic,
        focusKeyword: input.focusKeyword,
        tone: input.tone,
        targetAudience: input.targetAudience,
        quality: input.quality ?? "standard",
        input: input as unknown as Record<string, unknown>,
        options: input.options ?? {},
        autopilotSlotId: input.autopilotSlotId,
      });
    });

    const runId = run.id;

    try {
      // Persist modal_call_id INSIDE the trigger-modal step so that an Inngest
      // retry between trigger + DB-write cannot lose the call id (which is the
      // only handle we have to cancel the Modal job from the UI).
      const trigger = await step.run("trigger-modal", async () => {
        const result = await triggerAgentRun({
          runId,
          userId: input.userId,
          kind: (input.kind ?? "article") as
            | "article"
            | "autopilot"
            | "cluster"
            | "research_only"
            | "refresh"
            | "audit"
            | "cluster_plan"
            | "social_snippet"
            | "keyword_harvest"
            | "topic_research"
            | "research_and_write"
            | "competitor_monitor"
            | "internal_link_optimize"
            | "schema_doctor"
            | "content_brief"
            | "seasonal_calendar"
            | "cannibalization_resolve"
            | "image_optimize"
            | "performance_coach"
            | "newsletter_digest"
            | "social_publish"
            | "sponsorship_fit"
            | "cost_optimize"
            | "prompt_drift_detect"
            | "user_segment",
          topic: input.topic,
          focusKeyword: input.focusKeyword,
          tone: input.tone,
          targetAudience: input.targetAudience,
          quality: input.quality ?? "standard",
          options: input.options ?? {},
          autopilotSlotId: input.autopilotSlotId,
          articleId: input.articleId,
          articleIds: input.articleIds,
          clusterId: input.clusterId,
          clusterPillarTopic: input.clusterPillarTopic,
          socialPlatforms: input.socialPlatforms,
          gscSiteUrl: input.gscSiteUrl,
          newsletterPeriodDays: input.newsletterPeriodDays,
          snippetIds: input.snippetIds,
          costPeriodDays: input.costPeriodDays,
          driftScope: input.driftScope,
        });
        if (result.modalCallId) {
          const admin = getAdminClient();
          await admin
            .from("agent_runs")
            .update({ modal_call_id: result.modalCallId })
            .eq("id", runId);
        }
        return result;
      });

      return { runId, modalCallId: trigger.modalCallId };
    } catch (err) {
      await step.run("record-failure", async () => {
        await updateAgentRunStatus({
          runId,
          status: "failed",
          error: err instanceof Error ? err.message : "trigger_failed",
        });
      });
      throw err;
    }
  }
);
