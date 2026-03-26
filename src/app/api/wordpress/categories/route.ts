import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import { logger } from "@/lib/logger";

interface WpBlog {
  id: string;
  url: string;
  username: string;
  appPassword: string;
}

function getBlogCredentials(settings: Record<string, unknown>, blogId?: string): { wpUrl: string; auth: string } | null {
  const blogs = settings.wp_blogs as WpBlog[] | null;

  if (blogs && Array.isArray(blogs) && blogs.length > 0) {
    const blog = blogId ? blogs.find((b) => b.id === blogId) : blogs[0];
    if (blog?.url && blog?.username && blog?.appPassword) {
      return {
        wpUrl: blog.url.replace(/\/$/, ""),
        auth: Buffer.from(`${blog.username}:${decryptCredential(blog.appPassword)}`).toString("base64"),
      };
    }
  }

  // Fallback to legacy single-blog fields
  if (settings.wp_url && settings.wp_username && settings.wp_app_password) {
    return {
      wpUrl: (settings.wp_url as string).replace(/\/$/, ""),
      auth: Buffer.from(`${settings.wp_username}:${decryptCredential(settings.wp_app_password as string)}`).toString("base64"),
    };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blogId = req.nextUrl.searchParams.get("blogId") || undefined;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("wp_url, wp_username, wp_app_password, wp_blogs")
      .eq("user_id", user.id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: "No blogs connected. Add a blog in Settings." }, { status: 400 });
    }

    const creds = getBlogCredentials(settings, blogId);
    if (!creds) {
      return NextResponse.json({ error: "No blogs connected. Add a blog in Settings." }, { status: 400 });
    }

    const res = await fetch(`${creds.wpUrl}/wp-json/wp/v2/categories?per_page=100`, {
      headers: {
        Authorization: `Basic ${creds.auth}`,
        "User-Agent": "ArticleSauce/1.0",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({
          error: `WordPress authentication failed (${res.status}). Check credentials in Settings for this blog.`,
        }, { status: 401 });
      }
      return NextResponse.json({ error: `WordPress error (${res.status}): ${text.slice(0, 200)}` }, { status: res.status });
    }

    const categories = await res.json();
    const formatted = categories.map((c: { id: number; name: string; slug: string; count: number }) => ({
      id: c.id, name: c.name, slug: c.slug, count: c.count,
    }));

    return NextResponse.json({ categories: formatted });
  } catch (error: unknown) {
    logger.error("Failed to load categories", error);
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, blogId } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("wp_url, wp_username, wp_app_password, wp_blogs")
      .eq("user_id", user.id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: "WordPress not connected." }, { status: 400 });
    }

    const creds = getBlogCredentials(settings, blogId);
    if (!creds) {
      return NextResponse.json({ error: "WordPress not connected." }, { status: 400 });
    }

    const res = await fetch(`${creds.wpUrl}/wp-json/wp/v2/categories`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds.auth}`,
        "Content-Type": "application/json",
        "User-Agent": "ArticleSauce/1.0",
      },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ error: data.message || "Failed to create category" }, { status: res.status });
    }

    const category = await res.json();
    return NextResponse.json({
      category: { id: category.id, name: category.name, slug: category.slug, count: 0 },
    });
  } catch (error: unknown) {
    logger.error("Failed to load categories", error);
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}
