import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { defineTool, jsonResult, errorResult } from "@/lib/mcp/context";
import type { McpAuth } from "@/lib/mcp/auth";

const ARTICLE_SUMMARY_COLUMNS =
  "id, title, topic, slug, focus_keyword, meta_description, lifecycle, posted, published_platform, publish_at, scheduled_platform, quality, word_count, created_at, updated_at";

export function registerContentTools(server: McpServer, auth: McpAuth) {
  defineTool(server, auth, {
    name: "list_articles",
    description:
      "List the user's articles (newest first). Returns summaries without body content; use get_article for the full text.",
    scope: "read",
    schema: {
      search: z.string().max(200).optional().describe("Match against title/topic"),
      lifecycle: z.string().max(40).optional().describe("Filter by lifecycle, e.g. draft, published, scheduled"),
      posted: z.boolean().optional().describe("Filter by whether the article was published anywhere"),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).max(5000).default(0),
    },
    handler: async ({ search, lifecycle, posted, limit, offset }) => {
      const admin = getAdminClient();
      let query = admin
        .from("articles")
        .select(ARTICLE_SUMMARY_COLUMNS, { count: "exact" })
        .eq("user_id", auth.userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (lifecycle) query = query.eq("lifecycle", lifecycle);
      if (typeof posted === "boolean") query = query.eq("posted", posted);
      if (search) query = query.or(`title.ilike.%${search.replace(/[%,()]/g, "")}%,topic.ilike.%${search.replace(/[%,()]/g, "")}%`);
      const { data, count, error } = await query;
      if (error) return errorResult(error.message);
      return jsonResult({ total: count, articles: data ?? [] });
    },
  });

  defineTool(server, auth, {
    name: "get_article",
    description: "Get a single article by id, optionally including the full markdown content.",
    scope: "read",
    schema: {
      article_id: z.string().uuid(),
      include_content: z.boolean().default(false),
    },
    handler: async ({ article_id, include_content }) => {
      const admin = getAdminClient();
      const columns = include_content
        ? `${ARTICLE_SUMMARY_COLUMNS}, article_markdown, keywords, schema_json`
        : `${ARTICLE_SUMMARY_COLUMNS}, keywords`;
      const { data, error } = await admin
        .from("articles")
        .select(columns)
        .eq("id", article_id)
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult("Article not found");
      return jsonResult(data);
    },
  });

  defineTool(server, auth, {
    name: "update_article_metadata",
    description:
      "Update an article's SEO metadata (title, meta description, slug, keywords). Does not touch the body content.",
    scope: "write",
    schema: {
      article_id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      meta_description: z.string().max(300).optional(),
      slug: z.string().max(200).regex(/^[a-z0-9-]*$/, "slug must be lowercase alphanumeric with hyphens").optional(),
      keywords: z.array(z.string().max(100)).max(20).optional(),
    },
    handler: async ({ article_id, title, meta_description, slug, keywords }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (meta_description !== undefined) updates.meta_description = meta_description;
      if (slug !== undefined) updates.slug = slug;
      if (keywords !== undefined) updates.keywords = keywords;
      if (Object.keys(updates).length === 1) return errorResult("No fields to update");

      const admin = getAdminClient();
      const { data, error } = await admin
        .from("articles")
        .update(updates)
        .eq("id", article_id)
        .eq("user_id", auth.userId)
        .select("id, title, meta_description, slug, keywords")
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult("Article not found");
      return jsonResult({ updated: true, article: data });
    },
  });
}
