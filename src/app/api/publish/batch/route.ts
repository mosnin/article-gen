import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export const maxDuration = 120;

interface PlatformEntry {
  platform: string;
  accountId?: string;
  options?: Record<string, unknown>;
}

interface BatchRequest {
  articleId: string;
  platforms: PlatformEntry[];
}

interface PlatformResult {
  platform: string;
  success: boolean;
  postUrl?: string;
  editUrl?: string;
  error?: string;
}

const PLATFORM_ENDPOINTS: Record<string, string> = {
  wordpress: "/api/wordpress/publish",
  shopify: "/api/shopify/publish",
  medium: "/api/medium/publish",
  ghost: "/api/ghost/publish",
  devto: "/api/devto/publish",
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as BatchRequest;
    const { articleId, platforms } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: "Article ID is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "At least one platform is required" },
        { status: 400 }
      );
    }

    // Validate that the article belongs to the user
    const { data: article } = await supabase
      .from("articles")
      .select("id")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Validate all platforms before publishing
    for (const entry of platforms) {
      if (!PLATFORM_ENDPOINTS[entry.platform]) {
        return NextResponse.json(
          { error: `Unsupported platform: ${entry.platform}` },
          { status: 400 }
        );
      }
    }

    // Forward cookies from the incoming request for auth
    const cookieHeader = req.headers.get("cookie") ?? "";
    const origin = new URL(req.url).origin;

    // Publish to all platforms in parallel
    const results: PlatformResult[] = await Promise.all(
      platforms.map(async (entry): Promise<PlatformResult> => {
        const endpoint = PLATFORM_ENDPOINTS[entry.platform];
        const url = new URL(endpoint, origin).toString();

        // Build the body for the individual platform endpoint
        const platformBody: Record<string, unknown> = {
          articleId,
        };

        // Map accountId to the correct field per platform
        if (entry.accountId) {
          if (
            entry.platform === "wordpress" ||
            entry.platform === "ghost"
          ) {
            platformBody.blogId = entry.accountId;
          } else {
            platformBody.accountId = entry.accountId;
          }
        }

        // Spread any extra options (e.g., status, tags, categoryIds)
        if (entry.options) {
          Object.assign(platformBody, entry.options);
        }

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: cookieHeader,
            },
            body: JSON.stringify(platformBody),
          });

          const data = await res.json();

          if (data.success) {
            return {
              platform: entry.platform,
              success: true,
              postUrl: data.postUrl,
              editUrl: data.editUrl,
            };
          }

          return {
            platform: entry.platform,
            success: false,
            error: data.error || `Failed to publish to ${entry.platform}`,
          };
        } catch (err) {
          logger.error(`Batch publish failed for ${entry.platform}`, err);
          return {
            platform: entry.platform,
            success: false,
            error: `Failed to publish to ${entry.platform}`,
          };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error: unknown) {
    logger.error("Batch publish failed", error);
    return NextResponse.json(
      { error: "Failed to process batch publish" },
      { status: 500 }
    );
  }
}
