import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { wpBlogId, intervalMinutes, active } = await req.json() as {
      wpBlogId: string;
      intervalMinutes: number;
      active: boolean;
    };

    if (!wpBlogId) return NextResponse.json({ error: "Blog is required" }, { status: 400 });
    if (!Number.isFinite(intervalMinutes) || intervalMinutes < 15) {
      return NextResponse.json({ error: "Interval must be >= 15 minutes" }, { status: 400 });
    }

    const { error } = await supabase
      .from("blog_schedulers")
      .upsert({
        user_id: user.id,
        wp_blog_id: wpBlogId,
        interval_minutes: intervalMinutes,
        active,
        next_run_at: active ? new Date(Date.now() + intervalMinutes * 60_000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,wp_blog_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
