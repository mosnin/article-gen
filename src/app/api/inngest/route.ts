import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { autopilotCron } from "@/inngest/autopilot-cron";
import { generateAutopilotArticle } from "@/inngest/generate-autopilot-article";
import { onArticlePublished, weeklyContentReport } from "@/inngest/article-events";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [autopilotCron, generateAutopilotArticle, onArticlePublished, weeklyContentReport],
});
