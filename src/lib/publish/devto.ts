import { decryptCredential } from "@/lib/wp-crypto";
import type { DevToAccount } from "@/lib/publish-platforms";
import { logPublishEvent } from "@/lib/publish-log";
import { logger } from "@/lib/logger";
import type { DevtoPublishOptions, PublishHelperArgs, PublishResult } from "./index";

interface DevToArticleResponse {
  id?: number | string;
  url?: string;
}

/** Dev.to tags: lowercase, no spaces or special chars, max 4 tags */
function sanitizeDevToTags(tags: string[]): string[] {
  return tags
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 0 && t.length <= 30)
    .slice(0, 4);
}

export async function publishToDevto(
  args: PublishHelperArgs,
  options: DevtoPublishOptions = {},
): Promise<PublishResult> {
  const { admin, userId, articleId, platformAccountId } = args;
  const { tags, published, canonicalUrl } = options;

  try {
    const { data: settings } = await admin
      .from("user_settings")
      .select("devto_accounts")
      .eq("user_id", userId)
      .single();

    const accounts = (settings?.devto_accounts as DevToAccount[] | undefined) ?? [];
    const account = platformAccountId
      ? accounts.find((a) => a.id === platformAccountId)
      : accounts[0];

    if (!account?.apiKey) {
      return {
        success: false,
        platform: "devto",
        error: "No Dev.to account connected. Add one in Settings.",
      };
    }

    const { data: article } = await admin
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", userId)
      .single();

    if (!article) {
      return {
        success: false,
        platform: "devto",
        accountName: account.name,
        error: "Article not found",
      };
    }

    const apiKey = decryptCredential(account.apiKey);
    const devtoTags = sanitizeDevToTags(tags ?? []);

    const articlePayload: Record<string, unknown> = {
      title: article.title || article.topic,
      body_markdown: article.article_markdown || "",
      published: published ?? false,
      tags: devtoTags,
    };

    if (canonicalUrl) {
      articlePayload.canonical_url = canonicalUrl;
    }

    const res = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ article: articlePayload }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string | string[];
      };
      if (res.status === 401) {
        return {
          success: false,
          platform: "devto",
          accountName: account.name,
          error: "Dev.to authentication failed. Check your API key in Settings.",
        };
      }
      const errMsg =
        (Array.isArray(data.error) ? data.error.join(", ") : data.error) ||
        `Dev.to error (${res.status})`;
      return {
        success: false,
        platform: "devto",
        accountName: account.name,
        error: errMsg,
      };
    }

    const result = (await res.json()) as DevToArticleResponse;
    if (result.id === undefined || !result.url) {
      return {
        success: false,
        platform: "devto",
        accountName: account.name,
        error: "Dev.to returned no article",
      };
    }

    await admin
      .from("articles")
      .update({
        posted: true,
        published_platform: "devto",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .eq("user_id", userId);

    await logPublishEvent(admin, {
      userId,
      articleId,
      platform: "devto",
      accountName: account.name,
      postId: String(result.id),
      postUrl: result.url,
      editUrl: "https://dev.to/dashboard",
    });

    return {
      success: true,
      platform: "devto",
      accountName: account.name,
      postId: String(result.id),
      postUrl: result.url,
      editUrl: "https://dev.to/dashboard",
    };
  } catch (error: unknown) {
    logger.error("Failed to publish to Dev.to", error);
    return {
      success: false,
      platform: "devto",
      error: "Failed to publish to Dev.to",
    };
  }
}
