import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { encryptCredential, decryptCredential } from "@/lib/wp-crypto";

interface WpBlog {
  id: string;
  name: string;
  url: string;
  username: string;
  appPassword: string;
  authorName?: string;
  authorAbout?: string;
}

function encryptBlogPasswords(blogs: WpBlog[]): WpBlog[] {
  return blogs.map((blog) => ({
    ...blog,
    appPassword: blog.appPassword ? encryptCredential(blog.appPassword) : "",
  }));
}

function decryptBlogPasswords(blogs: WpBlog[]): WpBlog[] {
  return blogs.map((blog) => ({
    ...blog,
    appPassword: blog.appPassword ? decryptCredential(blog.appPassword) : "",
  }));
}

/** GET /api/settings — returns user settings with decrypted passwords */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: settings, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!settings) {
      return NextResponse.json({ settings: null });
    }

    // Decrypt blog passwords before sending to the client
    const blogs = settings.wp_blogs as WpBlog[] | null;
    const decryptedBlogs = blogs && Array.isArray(blogs)
      ? decryptBlogPasswords(blogs)
      : [];

    return NextResponse.json({
      settings: {
        ...settings,
        wp_blogs: decryptedBlogs,
        // Also decrypt legacy single-blog fields
        wp_app_password: settings.wp_app_password
          ? decryptCredential(settings.wp_app_password as string)
          : "",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/settings — encrypts passwords before saving */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const blogs = (body.wp_blogs as WpBlog[] | undefined) ?? [];

    // Encrypt app passwords before storing
    const encryptedBlogs = encryptBlogPasswords(
      blogs.filter((b: WpBlog) => b.url?.trim())
    );
    const firstBlog = encryptedBlogs[0] as WpBlog | undefined;

    const payload = {
      domain: body.domain ?? "",
      site_name: body.site_name ?? "",
      site_about: body.site_about ?? "",
      author_name: body.author_name ?? "",
      author_about: body.author_about ?? "",
      wp_blogs: encryptedBlogs,
      // Keep legacy fields in sync (encrypted)
      wp_url: firstBlog?.url ?? "",
      wp_username: firstBlog?.username ?? "",
      wp_app_password: firstBlog?.appPassword ?? "",
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const { error } = existing
      ? await supabase.from("user_settings").update(payload).eq("user_id", user.id)
      : await supabase.from("user_settings").insert({ user_id: user.id, ...payload });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
