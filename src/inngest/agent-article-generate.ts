import { inngest } from "@/lib/inngest";
import { triggerAgentRun } from "@/lib/modal-client";
import {
  createAgentRun,
  updateAgentRunStatus,
  getAgentRun,
} from "@/lib/agent-runs";

export const agentArticleGenerate = inngest.createFunction(
  {
    id: "agent-article-generate",
    name: "Agent: generate article",
    concurrency: { limit: 5 },
    retries: 2,
  },
  { event: "agent/article.generate" },
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
      const trigger = await step.run("trigger-modal", async () => {
        return triggerAgentRun({
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
            | "keyword_harvest",
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
        });
      });

      await step.run("record-call-id", async () => {
        await updateAgentRunStatus({
          runId,
          modalCallId: trigger.modalCallId,
        });
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
