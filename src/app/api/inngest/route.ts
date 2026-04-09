import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { embedArticle } from "@/inngest/embed-article";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [embedArticle],
});
