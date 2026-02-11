import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// PUT: Update a scheduled article
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Only allow editing pending schedules
    const { data: existing } = await supabase
      .from("scheduled_articles")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Can only edit pending schedules" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.topic !== undefined) updates.topic = body.topic.trim();
    if (body.focusKeyword !== undefined) updates.focus_keyword = body.focusKeyword.trim();
    if (body.quality !== undefined) updates.quality = body.quality;
    if (body.generateImages !== undefined) updates.generate_images = body.generateImages;
    if (body.autoPublish !== undefined) updates.auto_publish = body.autoPublish;
    if (body.publishStatus !== undefined) updates.publish_status = body.publishStatus;
    if (body.wpBlogId !== undefined) updates.wp_blog_id = body.wpBlogId || null;
    if (body.categoryIds !== undefined) updates.category_ids = body.categoryIds;
    if (body.scheduledFor !== undefined) updates.scheduled_for = body.scheduledFor;
    if (body.recurrence !== undefined) updates.recurrence = body.recurrence;
    if (body.recurrenceDay !== undefined) updates.recurrence_day = body.recurrenceDay;

    const { data, error } = await supabase
      .from("scheduled_articles")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedule: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Cancel/delete a scheduled article
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: existing } = await supabase
      .from("scheduled_articles")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

    // If processing, mark as cancelled instead of deleting
    if (existing.status === "processing") {
      const { error } = await supabase
        .from("scheduled_articles")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, action: "cancelled" });
    }

    const { error } = await supabase
      .from("scheduled_articles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, action: "deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
