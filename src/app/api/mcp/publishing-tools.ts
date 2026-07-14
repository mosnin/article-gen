import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import {
  publishToWordpress,
  publishToGhost,
  publishToMedium,
  publishToShopify,
  publishToDevto,
  type PublishHelperArgs,
  type PublishResult,
  type WordpressPublishOptions,
  type GhostPublishOptions,
  type MediumPublishOptions,
  type ShopifyPublishOptions,
  type DevtoPublishOptions,
} from "@/lib/publish";
import { deliverArticleWebhook } from "@/lib/publish/webhook";
import { defineTool, jsonResult, errorResult } from "@/lib/mcp/context";
import type { McpAuth } from "@/lib/mcp/auth";

const PUBLISH_PLATFORMS = ["wordpress", "ghost", "medium", "shopify", "devto", "webhook"] as const;

async function ownsArticle(userId: string, articleId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("articles")
    .select("id")
    .eq("id", articleId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export function registerPublishingTools(server: McpServer, auth: McpAuth) {
  defineTool(server, auth, {
    name: "publish_article",
    description:
      "Publish an article to a connected platform now. Platforms: wordpress, ghost, medium, shopify, devto, webhook. Options: status (draft|publish for wordpress/ghost/medium), tags, canonical_url, include_images (wordpress).",
    scope: "publish",
    schema: {
      article_id: z.string().uuid(),
      platform: z.enum(PUBLISH_PLATFORMS),
      connection_id: z.string().optional().describe("Which connection/account to publish through; defaults to the first"),
      status: z.enum(["draft", "publish", "public", "published", "unlisted"]).optional(),
      tags: z.array(z.string().max(50)).max(10).optional(),
      canonical_url: z.string().max(500).optional(),
      include_images: z.boolean().optional(),
    },
    handler: async ({ article_id, platform, connection_id, status, tags, canonical_url, include_images }) => {
      if (!(await ownsArticle(auth.userId, article_id))) return errorResult("Article not found");

      const admin = getAdminClient();

      if (platform === "webhook") {
        const result = await deliverArticleWebhook({
          supabase: admin,
          userId: auth.userId,
          articleId: article_id,
          webhookId: connection_id,
        });
        return result.success
          ? jsonResult({ success: true, platform, webhookUrl: result.webhookUrl })
          : errorResult(result.error ?? "Webhook delivery failed");
      }

      const args: PublishHelperArgs = {
        admin,
        userId: auth.userId,
        articleId: article_id,
        platformAccountId: connection_id ?? "",
      };

      let result: PublishResult;
      switch (platform) {
        case "wordpress":
          result = await publishToWordpress(args, {
            status: status === "publish" || status === "published" ? "publish" : "draft",
            includeImages: include_images ?? true,
          } as WordpressPublishOptions);
          break;
        case "ghost":
          result = await publishToGhost(args, {
            status: status === "publish" || status === "published" ? "published" : "draft",
            tags,
          } as GhostPublishOptions);
          break;
        case "medium":
          result = await publishToMedium(args, {
            status: status === "publish" || status === "published" || status === "public" ? "public" : status === "unlisted" ? "unlisted" : "draft",
            tags,
            canonicalUrl: canonical_url,
          } as MediumPublishOptions);
          break;
        case "shopify":
          result = await publishToShopify(args, {
            status: status === "publish" || status === "published" ? "publish" : "draft",
            tags,
          } as ShopifyPublishOptions);
          break;
        case "devto":
          result = await publishToDevto(args, {
            published: status === "publish" || status === "published" || status === "public",
            tags,
            canonicalUrl: canonical_url,
          } as DevtoPublishOptions);
          break;
      }

      return result.success
        ? jsonResult({ success: true, platform, postUrl: result.postUrl, editUrl: result.editUrl, account: result.accountName })
        : errorResult(result.error ?? `Failed to publish to ${platform}`);
    },
  });

  defineTool(server, auth, {
    name: "schedule_article_publish",
    description:
      "Schedule an article to publish at a future time (UTC ISO timestamp) on a connected platform. The publishing cron picks it up.",
    scope: "publish",
    schema: {
      article_id: z.string().uuid(),
      platform: z.enum(PUBLISH_PLATFORMS),
      publish_at: z.string().datetime({ offset: true }).describe("RFC3339 timestamp, must be in the future"),
      connection_id: z.string().optional(),
      status: z.enum(["draft", "publish"]).optional(),
    },
    handler: async ({ article_id, platform, publish_at, connection_id, status }) => {
      const publishDate = new Date(publish_at);
      if (Number.isNaN(publishDate.getTime()) || publishDate.getTime() <= Date.now()) {
        return errorResult("publish_at must be a valid future timestamp");
      }
      if (!(await ownsArticle(auth.userId, article_id))) return errorResult("Article not found");

      const admin = getAdminClient();
      const { error } = await admin
        .from("articles")
        .update({
          publish_at: publishDate.toISOString(),
          scheduled_platform: platform,
          scheduled_account_id: connection_id ?? null,
          scheduled_options: status ? { status } : {},
          lifecycle: "scheduled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", article_id)
        .eq("user_id", auth.userId);
      if (error) return errorResult(`Failed to schedule: ${error.message}`);
      return jsonResult({ scheduled: true, articleId: article_id, platform, publishAt: publishDate.toISOString() });
    },
  });

  defineTool(server, auth, {
    name: "cancel_scheduled_publish",
    description: "Cancel a pending scheduled publish for an article.",
    scope: "publish",
    schema: { article_id: z.string().uuid() },
    handler: async ({ article_id }) => {
      const admin = getAdminClient();
      const { data, error } = await admin
        .from("articles")
        .update({
          publish_at: null,
          scheduled_platform: null,
          scheduled_account_id: null,
          scheduled_options: {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", article_id)
        .eq("user_id", auth.userId)
        .select("id")
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult("Article not found");
      return jsonResult({ cancelled: true, articleId: article_id });
    },
  });

  defineTool(server, auth, {
    name: "get_publish_logs",
    description: "Get the publish history (platform, account, URL, time) for the user or a specific article.",
    scope: "read",
    schema: {
      article_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    },
    handler: async ({ article_id, limit }) => {
      const admin = getAdminClient();
      let query = admin
        .from("publish_logs")
        .select("id, article_id, platform, account_name, post_url, edit_url, published_at")
        .eq("user_id", auth.userId)
        .order("published_at", { ascending: false })
        .limit(limit);
      if (article_id) query = query.eq("article_id", article_id);
      const { data, error } = await query;
      if (error) return errorResult(error.message);
      return jsonResult(data ?? []);
    },
  });
}
