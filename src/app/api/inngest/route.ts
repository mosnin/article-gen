import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { autopilotCron } from "@/inngest/autopilot-cron";
import { generateAutopilotArticle } from "@/inngest/generate-autopilot-article";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [autopilotCron, generateAutopilotArticle],
});
