import { inngest } from "@/lib/inngest";

export const generateAutopilotArticle = inngest.createFunction(
  {
    id: "generate-autopilot-article",
    name: "Generate Autopilot Article",
    concurrency: { limit: 3 },
    retries: 1,
    triggers: [{ event: "autopilot/article.generate" }],
  },
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
