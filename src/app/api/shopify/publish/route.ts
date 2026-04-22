import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminClient } from "@/lib/supabase-admin";
import { publishToShopify } from "@/lib/publish";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, accountId, tags, status } = (await req.json()) as {
      articleId: string;
      accountId?: string;
      tags?: string[];
      status?: "draft" | "publish";
    };

    if (!articleId) {
      return NextResponse.json(
        { error: "Article ID is required" },
        { status: 400 },
      );
    }

    const admin = getAdminClient();
    const result = await publishToShopify(
      {
        admin,
        userId: user.id,
        articleId,
        platformAccountId: accountId ?? "",
      },
      { tags, status },
    );

    if (!result.success) {
      const msg = result.error ?? "Failed to publish to Shopify";
      const status = /authentication failed/i.test(msg)
        ? 401
        : /not found/i.test(msg)
          ? 404
          : /No Shopify store connected|Invalid Shopify domain|Could not find a blog/i.test(msg)
            ? 400
            : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    return NextResponse.json({
      success: true,
      postId: result.postId ? Number(result.postId) : undefined,
      postUrl: result.postUrl,
      editUrl: result.editUrl,
    });
  } catch (error: unknown) {
    logger.error("Failed to publish to Shopify", error);
    return NextResponse.json(
      { error: "Failed to publish to Shopify" },
      { status: 500 },
    );
  }
}
