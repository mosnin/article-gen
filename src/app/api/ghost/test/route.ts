import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import { createGhostJwt } from "@/lib/publish-platforms";
import type { GhostBlog } from "@/lib/publish-platforms";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { blogId } = await req.json() as { blogId?: string };

    const { data: settings } = await supabase
      .from("user_settings")
      .select("ghost_blogs")
      .eq("user_id", user.id)
      .single();

    const blogs = (settings?.ghost_blogs as GhostBlog[]) ?? [];
    const blog = blogId ? blogs.find((b) => b.id === blogId) : blogs[0];

    if (!blog?.url || !blog?.adminApiKey) {
      return NextResponse.json({ ok: false, message: "No Ghost blog found." });
    }

    const adminApiKey = decryptCredential(blog.adminApiKey);
    const ghostUrl = blog.url.replace(/\/$/, "");

    let jwt: string;
    try {
      jwt = createGhostJwt(adminApiKey);
    } catch {
      return NextResponse.json({ ok: false, message: "Invalid Admin API key format (expected id:secret)." });
    }

    const res = await fetch(`${ghostUrl}/ghost/api/admin/site/`, {
      headers: { Authorization: `Ghost ${jwt}`, "Accept-Version": "v5.0" },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ ok: false, message: "Authentication failed. Check your Admin API key." });
      }
      return NextResponse.json({ ok: false, message: `Ghost returned ${res.status}.` });
    }

    const data = await res.json();
    const title = data.site?.title || blog.name || ghostUrl;
    return NextResponse.json({ ok: true, message: `Connected to "${title}"` });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 500 });
  }
}
