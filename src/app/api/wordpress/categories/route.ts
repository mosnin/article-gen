import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("wp_url, wp_username, wp_app_password")
      .eq("user_id", user.id)
      .single();

    if (!settings?.wp_url || !settings?.wp_username || !settings?.wp_app_password) {
      return NextResponse.json(
        { error: "WordPress not connected. Add your WordPress credentials in Settings." },
        { status: 400 }
      );
    }

    const wpUrl = settings.wp_url.replace(/\/$/, "");
    const auth = Buffer.from(`${settings.wp_username}:${settings.wp_app_password}`).toString("base64");

    const res = await fetch(`${wpUrl}/wp-json/wp/v2/categories?per_page=100`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: "WordPress authentication failed. Check your credentials." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `WordPress error: ${text.slice(0, 200)}` },
        { status: res.status }
      );
    }

    const categories = await res.json();
    const formatted = categories.map((c: { id: number; name: string; slug: string; count: number }) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c.count,
    }));

    return NextResponse.json({ categories: formatted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("wp_url, wp_username, wp_app_password")
      .eq("user_id", user.id)
      .single();

    if (!settings?.wp_url || !settings?.wp_username || !settings?.wp_app_password) {
      return NextResponse.json(
        { error: "WordPress not connected." },
        { status: 400 }
      );
    }

    const wpUrl = settings.wp_url.replace(/\/$/, "");
    const auth = Buffer.from(`${settings.wp_username}:${settings.wp_app_password}`).toString("base64");

    const res = await fetch(`${wpUrl}/wp-json/wp/v2/categories`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.message || "Failed to create category" },
        { status: res.status }
      );
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
