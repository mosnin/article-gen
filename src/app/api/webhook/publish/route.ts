import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { deliverArticleWebhook } from "@/lib/publish/webhook";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, webhookId } = await req.json() as {
      articleId: string;
      webhookId?: string;
    };

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    const result = await deliverArticleWebhook({ supabase, userId: user.id, articleId, webhookId });

    if (!result.success) {
      const status = result.error === "Article not found" ? 404
        : result.error?.startsWith("Webhook returned") ? 502
        : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true, webhookUrl: result.webhookUrl, statusCode: result.statusCode });
  } catch (error: unknown) {
    logger.error("Failed to deliver webhook", error);
    return NextResponse.json({ error: "Failed to deliver webhook" }, { status: 500 });
  }
}
