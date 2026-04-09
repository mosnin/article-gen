import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { embedArticle } from "@/inngest/embed-article";
import { autopilotCron } from "@/inngest/autopilot-cron";
import { generateAutopilotArticle } from "@/inngest/generate-autopilot-article";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [embedArticle, autopilotCron, generateAutopilotArticle],
});
