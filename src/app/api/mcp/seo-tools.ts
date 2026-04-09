import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeSERP } from "@/lib/serp-analyzer";
import { estimateKeywordDifficulty } from "@/lib/keyword-difficulty";

export function registerSeoTools(server: McpServer) {

  server.tool("analyze_serp",
    "Analyze top-ranking pages for a keyword to inform content strategy",
    { keyword: z.string(), num_results: z.number().default(5) },
    async ({ keyword, num_results }) => {
      const analysis = await analyzeSERP(keyword, num_results);
      return { content: [{ type: "text", text: JSON.stringify(analysis) }] };
    }
  );

  server.tool("get_keyword_difficulty",
    "Estimate keyword difficulty and competition level (0-100)",
    { keyword: z.string() },
    async ({ keyword }) => {
      const result = await estimateKeywordDifficulty(keyword);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool("bulk_keyword_difficulty",
    "Get difficulty scores for multiple keywords at once",
    { keywords: z.array(z.string()).max(10) },
    async ({ keywords }) => {
      const results = await Promise.allSettled(keywords.map(k => estimateKeywordDifficulty(k)));
      const scores = results.map((r, i) => ({
        keyword: keywords[i],
        ...(r.status === "fulfilled" ? r.value : { difficulty: null, label: "Error" }),
      }));
      return { content: [{ type: "text", text: JSON.stringify(scores) }] };
    }
  );

  server.tool("find_content_gaps",
    "Find underserved content opportunities in a niche using Exa",
    { niche: z.string(), num_results: z.number().default(10) },
    async ({ niche, num_results }) => {
      const { findContentGaps } = await import("@/lib/exa");
      const gaps = await findContentGaps(niche, num_results);
      return { content: [{ type: "text", text: JSON.stringify(gaps) }] };
    }
  );
}
