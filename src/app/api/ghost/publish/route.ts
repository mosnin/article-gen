import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import { createGhostJwt } from "@/lib/publish-platforms";
import type { GhostBlog } from "@/lib/publish-platforms";
import { marked } from "marked";

export const maxDuration = 60;

interface StoredImage {
  type: string;
  altText: string;
  storagePath: string;
  publicUrl: string;
  success: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, blogId, tags, status } = await req.json() as {
      articleId: string;
      blogId?: string;
      tags?: string[];
      status?: "draft" | "published";
    };

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("ghost_blogs")
      .eq("user_id", user.id)
      .single();

    const blogs = (settings?.ghost_blogs as GhostBlog[]) ?? [];
    const blog = blogId ? blogs.find((b) => b.id === blogId) : blogs[0];

    if (!blog?.url || !blog?.adminApiKey) {
      return NextResponse.json({ error: "No Ghost blog connected. Add one in Settings." }, { status: 400 });
    }

    const { data: article } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const adminApiKey = decryptCredential(blog.adminApiKey);
    const ghostUrl = blog.url.replace(/\/$/, "");

    let jwt: string;
    try {
      jwt = createGhostJwt(adminApiKey);
    } catch {
      return NextResponse.json(
        { error: "Invalid Ghost Admin API key format. It should be 'id:secret' from Ghost Admin > Integrations." },
        { status: 400 }
      );
    }

    // Convert markdown to HTML for Ghost
    const html = await marked(article.article_markdown || "");

    // Featured image from stored images
    const storedImages = (article.generated_images as StoredImage[]) ?? [];
    const featuredImage = storedImages.find((i) => i.success && i.publicUrl && i.type === "Featured Image");

    const postPayload: Record<string, unknown> = {
      title: article.title || article.topic,
      html,
      status: status ?? "draft",
      meta_description: article.meta_description || "",
      custom_excerpt: article.meta_description || "",
      slug: article.slug || undefined,
    };

    if (tags && tags.length > 0) {
      postPayload.tags = tags.map((t) => ({ name: t }));
    }

    if (featuredImage) {
      postPayload.feature_image = featuredImage.publicUrl;
      postPayload.feature_image_alt = featuredImage.altText;
    }

    const res = await fetch(`${ghostUrl}/ghost/api/admin/posts/`, {
      method: "POST",
      headers: {
        Authorization: `Ghost ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ posts: [postPayload] }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: `Ghost authentication failed (${res.status}). Check your Admin API key in Settings.` },
          { status: 401 }
        );
      }
      const errMsg =
        data.errors?.[0]?.message ||
        data.errors?.[0]?.context ||
        `Ghost error (${res.status})`;
      return NextResponse.json({ error: errMsg }, { status: res.status });
    }

    const result = await res.json();
    const post = result.posts?.[0];

    await supabase
      .from("articles")
      .update({ posted: true, published_platform: "ghost", updated_at: new Date().toISOString() })
      .eq("id", articleId);

    return NextResponse.json({
      success: true,
      postId: post.id,
      postUrl: post.url,
      editUrl: `${ghostUrl}/ghost/#/editor/post/${post.id}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
