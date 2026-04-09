import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import {
  embedArticle,
  generateAutopilotArticle,
  autopilotCron,
  onArticlePublished,
  weeklyContentReport,
} from "@/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    embedArticle,
    generateAutopilotArticle,
    autopilotCron,
    onArticlePublished,
    weeklyContentReport,
  ],
});
