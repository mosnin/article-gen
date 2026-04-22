import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { autopilotCron } from "@/inngest/autopilot-cron";
import { generateAutopilotArticle } from "@/inngest/generate-autopilot-article";
import { agentArticleGenerate } from "@/inngest/agent-article-generate";
import { agentEventsRetention } from "@/inngest/agent-events-retention";
import { agentRunsStuckAlert } from "@/inngest/agent-runs-stuck-alert";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    autopilotCron,
    generateAutopilotArticle,
    agentArticleGenerate,
    agentEventsRetention,
    agentRunsStuckAlert,
  ],
});
