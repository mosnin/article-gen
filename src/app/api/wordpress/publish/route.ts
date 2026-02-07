import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { marked } from "marked";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, categoryIds, status: postStatus } = await req.json();

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    // Get WordPress credentials
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

    // Get the article
    const { data: article } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const wpUrl = settings.wp_url.replace(/\/$/, "");
    const auth = Buffer.from(`${settings.wp_username}:${settings.wp_app_password}`).toString("base64");

    // Convert markdown to HTML
    const htmlContent = await marked(article.article_markdown || "");

    // Build the post payload
    const postPayload: Record<string, unknown> = {
      title: article.title || article.topic,
      content: htmlContent,
      slug: article.slug || undefined,
      status: postStatus === "publish" ? "publish" : "draft",
      excerpt: article.meta_description || "",
    };

    if (categoryIds && categoryIds.length > 0) {
      postPayload.categories = categoryIds;
    }

    const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postPayload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: "WordPress authentication failed. Check your credentials." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: data.message || `WordPress error (${res.status})` },
        { status: res.status }
      );
    }

    const post = await res.json();

    // Mark article as posted
    await supabase
      .from("articles")
      .update({ posted: true, updated_at: new Date().toISOString() })
      .eq("id", articleId);

    return NextResponse.json({
      success: true,
      postId: post.id,
      postUrl: post.link,
      editUrl: `${wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
