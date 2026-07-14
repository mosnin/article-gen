import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeSERP } from "@/lib/serp-analyzer";
import { estimateKeywordDifficulty } from "@/lib/keyword-difficulty";
import { defineTool, jsonResult } from "@/lib/mcp/context";
import type { McpAuth } from "@/lib/mcp/auth";

export function registerSeoTools(server: McpServer, auth: McpAuth) {
  defineTool(server, auth, {
    name: "analyze_serp",
    description: "Analyze top-ranking pages for a keyword to inform content strategy.",
    scope: "read",
    schema: { keyword: z.string().min(1).max(200), num_results: z.number().int().min(1).max(10).default(5) },
    handler: async ({ keyword, num_results }) => {
      const analysis = await analyzeSERP(keyword, num_results);
      return jsonResult(analysis);
    },
  });

  defineTool(server, auth, {
    name: "get_keyword_difficulty",
    description: "Estimate keyword difficulty and competition level (0-100).",
    scope: "read",
    schema: { keyword: z.string().min(1).max(200) },
    handler: async ({ keyword }) => {
      const result = await estimateKeywordDifficulty(keyword);
      return jsonResult(result);
    },
  });

  defineTool(server, auth, {
    name: "bulk_keyword_difficulty",
    description: "Get difficulty scores for multiple keywords at once (max 10).",
    scope: "read",
    schema: { keywords: z.array(z.string().min(1).max(200)).min(1).max(10) },
    handler: async ({ keywords }) => {
      const results = await Promise.allSettled(keywords.map(k => estimateKeywordDifficulty(k)));
      const scores = results.map((r, i) => (
        r.status === "fulfilled" ? r.value : { keyword: keywords[i], difficulty: null, label: "Error" }
      ));
      return jsonResult(scores);
    },
  });

  defineTool(server, auth, {
    name: "find_content_gaps",
    description: "Find underserved content opportunities in a niche using Exa.",
    scope: "read",
    schema: { niche: z.string().min(1).max(200), num_results: z.number().int().min(1).max(20).default(10) },
    handler: async ({ niche, num_results }) => {
      const { findContentGaps } = await import("@/lib/exa");
      const gaps = await findContentGaps(niche, num_results);
      return jsonResult(gaps);
    },
  });
}
