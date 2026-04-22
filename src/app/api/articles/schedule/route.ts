import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, platform, accountId, publishAt, scheduledOptions } =
      (await req.json()) as {
        articleId: string;
        platform: string;
        accountId?: string;
        publishAt: string;
        scheduledOptions?: Record<string, unknown>;
      };

    if (!articleId || !platform || !publishAt) {
      return NextResponse.json(
        { error: "articleId, platform, and publishAt are required" },
        { status: 400 }
      );
    }

    // Validate the publishAt date is in the future
    const publishDate = new Date(publishAt);
    if (isNaN(publishDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid publishAt date" },
        { status: 400 }
      );
    }

    if (publishDate <= new Date()) {
      return NextResponse.json(
        { error: "publishAt must be in the future" },
        { status: 400 }
      );
    }

    // Verify the article belongs to this user
    const { data: article } = await supabase
      .from("articles")
      .select("id")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Save the scheduled publish info
    const { error: updateError } = await supabase
      .from("articles")
      .update({
        publish_at: publishDate.toISOString(),
        scheduled_platform: platform,
        scheduled_account_id: accountId ?? null,
        scheduled_options: scheduledOptions ?? {},
        lifecycle: "scheduled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to schedule: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scheduledAt: publishDate.toISOString(),
    });
  } catch (error: unknown) {
    logger.error("Unexpected error in articles/schedule", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

// ── PATCH: reschedule an existing article (no platform change) ───────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, publishAt } = (await req.json()) as {
      articleId: string;
      publishAt: string;
    };

    if (!articleId || !publishAt) {
      return NextResponse.json(
        { error: "articleId and publishAt are required" },
        { status: 400 }
      );
    }

    const publishDate = new Date(publishAt);
    if (isNaN(publishDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid publishAt date" },
        { status: 400 }
      );
    }

    const isFuture = publishDate.getTime() > Date.now();

    const updatePayload: Record<string, unknown> = {
      publish_at: publishDate.toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isFuture) {
      updatePayload.lifecycle = "scheduled";
    }

    const { error: updateError } = await supabase
      .from("articles")
      .update(updatePayload)
      .eq("id", articleId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to reschedule: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    logger.error("Unexpected error in articles/schedule PATCH", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

// ── DELETE: cancel a schedule (reverse scheduling) ───────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId } = (await req.json()) as { articleId: string };
    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("articles")
      .update({
        publish_at: null,
        lifecycle: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to cancel schedule: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    logger.error("Unexpected error in articles/schedule DELETE", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
