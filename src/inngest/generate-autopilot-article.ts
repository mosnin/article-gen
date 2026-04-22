// TODO(autopilot-rewire): This function previously called OpenAI directly,
// saved the article, and flipped `user_settings.autopilot_plan[slotId].status`
// to "done" with the generated `articleId`. After migrating to the agent
// pipeline the generation / credit deduction / saving / status broadcasting
// all live inside `agent/article.generate`. The agent webhook
// (`/api/agent/webhook`) already writes back `agent_runs.article_id` on
// `run_completed`; a follow-up task must consume that event to also flip the
// autopilot slot (by `autopilotSlotId === slotId`) to `{ status: "done",
// articleId }`. Until that follow-up lands the slot stays in its prior state.
import { inngest } from "@/lib/inngest";

export const generateAutopilotArticle = inngest.createFunction(
  {
    id: "generate-autopilot-article",
    name: "Generate Autopilot Article",
    concurrency: { limit: 3 },
    retries: 1,
  },
  { event: "autopilot/article.generate" },
  async ({ event }) => {
    const { userId, slotId, keyword, topic, contentType } = event.data;

    // Fire a dedicated agent run; the agent pipeline owns credit deduction,
    // rate limiting, saving, and status broadcasting. The `autopilotSlotId`
    // is threaded through so the webhook can correlate completion back to the
    // originating slot.
    await inngest.send({
      name: "agent/article.generate",
      data: {
        userId,
        kind: "autopilot",
        topic,
        focusKeyword: keyword,
        quality: "standard",
        options: { imageCount: 4, autoPublish: false },
        autopilotSlotId: slotId,
      },
    });

    return { dispatched: true, slotId, contentType };
  }
);
