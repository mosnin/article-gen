import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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

export const maxDuration = 60;

interface ArticleRow {
  id: string;
  user_id: string;
  scheduled_platform: string | null;
  scheduled_account_id: string | null;
  scheduled_options: Record<string, unknown> | null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = Buffer.from(a);
  const bBytes = Buffer.from(b);
  if (aBytes.length !== bBytes.length) {
    // Still do a comparison to avoid timing leaks on length
    crypto.timingSafeEqual(aBytes, aBytes);
    return false;
  }
  return crypto.timingSafeEqual(aBytes, bBytes);
}

async function dispatchPublish(
  platform: PublishPlatform | string,
  args: PublishHelperArgs,
  options: Record<string, unknown>,
): Promise<PublishResult> {
  switch (platform as PublishPlatform) {
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
    default:
      return {
        success: false,
        platform: platform as PublishPlatform,
        error: `unknown platform: ${platform ?? "null"}`,
      };
  }
}

async function handleCron(req: NextRequest): Promise<Response> {
  // Verify cron secret with timing-safe comparison
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!timingSafeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();

  // Query articles due for publishing
  const { data: dueArticles, error: queryError } = await admin
    .from("articles")
    .select(
      "id, user_id, scheduled_platform, scheduled_account_id, scheduled_options",
    )
    .lte("publish_at", new Date().toISOString())
    .eq("posted", false)
    .not("scheduled_platform", "is", null)
    .limit(10);

  if (queryError) {
    return NextResponse.json(
      { error: `Query failed: ${queryError.message}` },
      { status: 500 },
    );
  }

  if (!dueArticles || dueArticles.length === 0) {
    return NextResponse.json({ processed: 0, results: [] });
  }

  const results: Array<{
    articleId: string;
    platform: string | null;
    success: boolean;
    error?: string;
  }> = [];

  for (const article of dueArticles as ArticleRow[]) {
    const platform = article.scheduled_platform;
    const options = article.scheduled_options ?? {};

    if (!platform) {
      // Shouldn't happen due to the .not("scheduled_platform","is",null) filter,
      // but guard anyway. Leave publish_at untouched so nothing retries forever.
      results.push({
        articleId: article.id,
        platform: null,
        success: false,
        error: "scheduled_platform is null",
      });
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
      // The helpers themselves already set posted=true and call logPublishEvent.
      // Here we upgrade the lifecycle and capture a canonical published_at while
      // clearing publish_at so the cron doesn't re-pick the row.
      await admin
        .from("articles")
        .update({
          posted: true,
          lifecycle: "published",
          published_at: new Date().toISOString(),
          publish_at: null,
        })
        .eq("id", article.id);
    } else {
      // Failure path: persist lastError on scheduled_options for retry visibility.
      // Leave posted=false and publish_at unchanged so the next tick retries.
      const nextOptions: Record<string, unknown> = {
        ...options,
        lastError: result.error ?? "Unknown publish error",
        lastErrorAt: new Date().toISOString(),
      };
      await admin
        .from("articles")
        .update({ scheduled_options: nextOptions })
        .eq("id", article.id);
    }

    results.push({
      articleId: article.id,
      platform,
      success: result.success,
      error: result.error,
    });
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
