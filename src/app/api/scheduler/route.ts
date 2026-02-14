import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: schedulers }, { data: posts }, { data: settings }] = await Promise.all([
      supabase
        .from("blog_schedulers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("scheduled_posts")
        .select("*")
        .eq("user_id", user.id)
        .order("queue_order", { ascending: true }),
      supabase
        .from("user_settings")
        .select("wp_blogs")
        .eq("user_id", user.id)
        .single(),
    ]);

    return NextResponse.json({
      schedulers: schedulers || [],
      posts: posts || [],
      blogs: (settings?.wp_blogs as unknown[]) || [],
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
