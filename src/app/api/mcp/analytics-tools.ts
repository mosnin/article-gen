import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { decryptCredential } from "@/lib/wp-crypto";
import { getAccessToken } from "@/lib/gsc-auth";
import { defineTool, jsonResult, errorResult } from "@/lib/mcp/context";
import type { McpAuth } from "@/lib/mcp/auth";

export function registerAnalyticsTools(server: McpServer, auth: McpAuth) {
  defineTool(server, auth, {
    name: "get_content_audit",
    description: "Get freshness/health scores for the user's most recent articles, flagging ones that need a refresh.",
    scope: "read",
    schema: { limit: z.number().int().min(1).max(100).default(50) },
    handler: async ({ limit }) => {
      const supabase = getAdminClient();
      const { data: articles } = await supabase
        .from("articles")
        .select("id, title, focus_keyword, content, meta_description, word_count, created_at, status")
        .eq("user_id", auth.userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      const now = new Date();
      const scored = (articles ?? []).map(a => {
        const wordCount = a.word_count ?? (a.content ?? "").split(/\s+/).length;
        const ageInDays = Math.floor((now.getTime() - new Date(a.created_at).getTime()) / 86400000);
        const score = Math.min(100,
          (wordCount >= 1000 ? 30 : wordCount >= 500 ? 15 : 0) +
          (a.meta_description ? 20 : 0) +
          ((a.content ?? "").includes("<img") ? 20 : 0) +
          (ageInDays < 90 ? 20 : ageInDays < 180 ? 10 : 0) +
          10
        );
        return { id: a.id, title: a.title, keyword: a.focus_keyword, wordCount, ageInDays, score, needsRefresh: ageInDays > 90 };
      });

      return jsonResult({ articles: scored, avgScore: scored.reduce((s, a) => s + a.score, 0) / (scored.length || 1) });
    },
  });

  defineTool(server, auth, {
    name: "get_gsc_top_keywords",
    description: "Get the user's top ranking keywords from Google Search Console (last 28 days). Requires GSC to be connected.",
    scope: "read",
    schema: { limit: z.number().int().min(1).max(100).default(20) },
    handler: async ({ limit }) => {
      const supabase = getAdminClient();
      const { data: settings } = await supabase
        .from("user_settings")
        .select("gsc_refresh_token, gsc_site_url")
        .eq("user_id", auth.userId)
        .single();

      if (!settings?.gsc_refresh_token || !settings?.gsc_site_url) {
        return errorResult("Google Search Console is not connected");
      }

      const refreshToken = decryptCredential(settings.gsc_refresh_token as string);
      const accessToken = await getAccessToken(refreshToken);
      const siteUrl = settings.gsc_site_url as string;

      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 28 * 86400000).toISOString().split("T")[0];

      const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, dimensions: ["query"], rowLimit: limit }),
      });

      const data = await res.json() as { rows?: Array<{ keys: string[]; clicks: number; impressions: number; position: number }> };
      const keywords = (data.rows ?? []).map(r => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 }));

      return jsonResult(keywords);
    },
  });

  defineTool(server, auth, {
    name: "get_article_stats",
    description: "Get content statistics: total articles, published count, and articles created in the last 30 days.",
    scope: "read",
    schema: {},
    handler: async () => {
      const supabase = getAdminClient();
      const [{ count: total }, { count: published }] = await Promise.all([
        supabase.from("articles").select("*", { count: "exact", head: true }).eq("user_id", auth.userId),
        supabase.from("articles").select("*", { count: "exact", head: true }).eq("user_id", auth.userId).eq("status", "published"),
      ]);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { count: thisMonth } = await supabase.from("articles").select("*", { count: "exact", head: true }).eq("user_id", auth.userId).gte("created_at", thirtyDaysAgo);
      return jsonResult({ total, published, thisMonth });
    },
  });
}
