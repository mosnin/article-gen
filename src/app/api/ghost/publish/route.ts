import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminClient } from "@/lib/supabase-admin";
import { publishToGhost } from "@/lib/publish";
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

    const { articleId, blogId, tags, status } = (await req.json()) as {
      articleId: string;
      blogId?: string;
      tags?: string[];
      status?: "draft" | "published";
    };

    if (!articleId) {
      return NextResponse.json(
        { error: "Article ID is required" },
        { status: 400 },
      );
    }

    const admin = getAdminClient();
    const result = await publishToGhost(
      { admin, userId: user.id, articleId, platformAccountId: blogId ?? "" },
      { tags, status },
    );

    if (!result.success) {
      const msg = result.error ?? "Failed to publish to Ghost";
      const status = /authentication failed/i.test(msg)
        ? 401
        : /not found/i.test(msg)
          ? 404
          : /No Ghost blog connected|Invalid Ghost|Invalid Ghost Admin API key/i.test(msg)
            ? 400
            : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      postUrl: result.postUrl,
      editUrl: result.editUrl,
    });
  } catch (error: unknown) {
    logger.error("Failed to publish to Ghost", error);
    return NextResponse.json(
      { error: "Failed to publish to Ghost" },
      { status: 500 },
    );
  }
}
