/**
 * Scheduled-publish sweep, shared by the Inngest cron (primary trigger) and
 * the /api/cron/publish HTTP route (manual / external trigger).
 *
 * Picks up articles whose publish_at has passed, dispatches to the scheduled
 * platform (including custom webhooks), upgrades lifecycle on success, and
 * retries failures up to MAX_ATTEMPTS before abandoning the schedule so a
 * permanently broken job cannot retry forever.
 */

import { getAdminClient } from "@/lib/supabase-admin";
import {
  publishToWordpress,
  publishToGhost,
  publishToMedium,
  publishToShopify,
  publishToDevto,
  type PublishPlatform,
  type PublishResult,
  type PublishHelperArgs,
  type WordpressPublishOptions,
  type GhostPublishOptions,
  type MediumPublishOptions,
  type ShopifyPublishOptions,
  type DevtoPublishOptions,
} from "@/lib/publish";
import { deliverArticleWebhook } from "@/lib/publish/webhook";

const MAX_ATTEMPTS = 5;

interface ArticleRow {
  id: string;
  user_id: string;
  scheduled_platform: string | null;
  scheduled_account_id: string | null;
  scheduled_options: Record<string, unknown> | null;
}

export type SweepResult = {
  articleId: string;
  platform: string | null;
  success: boolean;
  abandoned?: boolean;
  error?: string;
};

async function dispatchPublish(
  platform: string,
  args: PublishHelperArgs,
  options: Record<string, unknown>,
): Promise<PublishResult> {
  switch (platform as PublishPlatform | "webhook") {
    case "wordpress":
      return publishToWordpress(args, options as WordpressPublishOptions);
    case "ghost":
      return publishToGhost(args, options as GhostPublishOptions);
    case "medium":
      return publishToMedium(args, options as MediumPublishOptions);
    case "shopify":
      return publishToShopify(args, options as ShopifyPublishOptions);
    case "devto":
      return publishToDevto(args, options as DevtoPublishOptions);
    case "webhook": {
      const result = await deliverArticleWebhook({
        supabase: args.admin,
        userId: args.userId,
        articleId: args.articleId,
        webhookId: args.platformAccountId || undefined,
      });
      return {
        success: result.success,
        platform: "webhook" as PublishPlatform,
        postUrl: result.webhookUrl,
        error: result.error,
      };
    }
    default:
      return {
        success: false,
        platform: platform as PublishPlatform,
        error: `unknown platform: ${platform || "null"}`,
      };
  }
}

export async function sweepScheduledPublishes(limit = 10): Promise<{ processed: number; results: SweepResult[] }> {
  const admin = getAdminClient();

  const { data: dueArticles, error: queryError } = await admin
    .from("articles")
    .select("id, user_id, scheduled_platform, scheduled_account_id, scheduled_options")
    .lte("publish_at", new Date().toISOString())
    .eq("posted", false)
    .not("scheduled_platform", "is", null)
    .limit(limit);

  if (queryError) {
    throw new Error(`Scheduled-publish query failed: ${queryError.message}`);
  }
  if (!dueArticles || dueArticles.length === 0) {
    return { processed: 0, results: [] };
  }

  const results: SweepResult[] = [];

  for (const article of dueArticles as ArticleRow[]) {
    const platform = article.scheduled_platform;
    const options = article.scheduled_options ?? {};

    if (!platform) {
      results.push({ articleId: article.id, platform: null, success: false, error: "scheduled_platform is null" });
      continue;
    }

    const args: PublishHelperArgs = {
      admin,
      userId: article.user_id,
      articleId: article.id,
      platformAccountId: article.scheduled_account_id ?? "",
    };

    let result: PublishResult;
    try {
      result = await dispatchPublish(platform, args, options);
    } catch (err) {
      result = {
        success: false,
        platform: platform as PublishPlatform,
        error: err instanceof Error ? err.message : "publish threw",
      };
    }

    if (result.success) {
      // Platform helpers set posted=true and write publish logs; here we
      // upgrade lifecycle and clear the schedule so the row isn't re-picked.
      await admin
        .from("articles")
        .update({
          posted: true,
          lifecycle: "published",
          published_at: new Date().toISOString(),
          publish_at: null,
        })
        .eq("id", article.id);
      results.push({ articleId: article.id, platform, success: true });
      continue;
    }

    // Failure: count attempts; abandon after MAX_ATTEMPTS so a permanently
    // broken schedule (deleted account, dead endpoint) can't retry forever.
    const attempts = (typeof options.attempts === "number" ? options.attempts : 0) + 1;
    const abandoned = attempts >= MAX_ATTEMPTS;
    const nextOptions: Record<string, unknown> = {
      ...options,
      attempts,
      lastError: result.error ?? "Unknown publish error",
      lastErrorAt: new Date().toISOString(),
      ...(abandoned ? { abandoned: true } : {}),
    };
    await admin
      .from("articles")
      .update({
        scheduled_options: nextOptions,
        // Clearing publish_at stops retries; scheduled_platform + options are
        // kept so the UI can show what failed and let the user reschedule.
        ...(abandoned ? { publish_at: null } : {}),
      })
      .eq("id", article.id);

    results.push({ articleId: article.id, platform, success: false, abandoned, error: result.error });
  }

  return { processed: results.length, results };
}
