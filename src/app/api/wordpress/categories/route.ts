import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getBlogCredentials, type WordPressUserSettings } from "@/lib/wordpress";
import { requireUser } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const CreateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  blogId: z.string().optional(),
});


export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await requireUser(supabase);
    if ("response" in authResult) return authResult.response;
    const { user } = authResult;

    const blogId = req.nextUrl.searchParams.get("blogId") || undefined;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("wp_url, wp_username, wp_app_password, wp_blogs")
      .eq("user_id", user.id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: "No blogs connected. Add a blog in Connected Blogs." }, { status: 400 });
    }

    const creds = getBlogCredentials(settings as WordPressUserSettings, blogId);
    if (!creds) {
      return NextResponse.json({ error: "No blogs connected. Add a blog in Connected Blogs." }, { status: 400 });
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
          error: `WordPress authentication failed (${res.status}). Check credentials in Connected Blogs for this blog.`,
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
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await requireUser(supabase);
    if ("response" in authResult) return authResult.response;
    const { user } = authResult;

    const parsed = await parseJsonBody(req, CreateCategorySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { name, blogId } = parsed;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("wp_url, wp_username, wp_app_password, wp_blogs")
      .eq("user_id", user.id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: "WordPress not connected." }, { status: 400 });
    }

    const creds = getBlogCredentials(settings as WordPressUserSettings, blogId);
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
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
