import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface IncomingPost {
  topic: string;
  keyword?: string;
  quality?: "standard" | "premium";
  withImages?: boolean;
  scheduleType?: "interval" | "calendar";
  scheduledFor?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { wpBlogId, items } = await req.json() as { wpBlogId: string; items: IncomingPost[] };

    if (!wpBlogId) return NextResponse.json({ error: "Blog is required" }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const { data: last } = await supabase
      .from("scheduled_posts")
      .select("queue_order")
      .eq("user_id", user.id)
      .eq("wp_blog_id", wpBlogId)
      .order("queue_order", { ascending: false })
      .limit(1)
      .single();

    let startOrder = (last?.queue_order || 0) + 1;

    const rows = items
      .filter((item) => item.topic?.trim())
      .map((item) => ({
        user_id: user.id,
        wp_blog_id: wpBlogId,
        topic: item.topic.trim(),
        focus_keyword: (item.keyword || "").trim(),
        quality: item.quality || "premium",
        with_images: !!item.withImages,
        schedule_type: item.scheduleType || "interval",
        scheduled_for: item.scheduleType === "calendar" && item.scheduledFor ? item.scheduledFor : null,
        queue_order: startOrder++,
        updated_at: new Date().toISOString(),
      }));

    if (!rows.length) return NextResponse.json({ error: "No valid items" }, { status: 400 });

    const { error } = await supabase.from("scheduled_posts").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, count: rows.length });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { error } = await supabase
      .from("scheduled_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
