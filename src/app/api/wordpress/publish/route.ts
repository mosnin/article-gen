import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { marked } from "marked";

export const maxDuration = 60;

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
        auth: Buffer.from(`${blog.username}:${blog.appPassword}`).toString("base64"),
      };
    }
  }

  if (settings.wp_url && settings.wp_username && settings.wp_app_password) {
    return {
      wpUrl: (settings.wp_url as string).replace(/\/$/, ""),
      auth: Buffer.from(`${settings.wp_username}:${settings.wp_app_password}`).toString("base64"),
    };
  }

  return null;
}

interface ImageUploadResult {
  wpMediaId: number;
  wpUrl: string;
  altText: string;
  type: string;
}

async function uploadImageToWP(
  wpUrl: string,
  auth: string,
  b64: string,
  filename: string,
  altText: string
): Promise<{ mediaId: number; url: string } | null> {
  try {
    const buffer = Buffer.from(b64, "base64");

    const uploadRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}.png"`,
      },
      body: buffer,
    });

    if (!uploadRes.ok) return null;

    const media = await uploadRes.json();

    // Set alt text
    if (altText) {
      await fetch(`${wpUrl}/wp-json/wp/v2/media/${media.id}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alt_text: altText }),
      });
    }

    return { mediaId: media.id, url: media.source_url };
  } catch {
    return null;
  }
}

function injectImagesIntoHtml(
  html: string,
  images: ImageUploadResult[]
): string {
  const inlineImages = images.filter((img) => img.type !== "Featured Image");
  if (inlineImages.length === 0) return html;

  // Find all H2 headings to place images between sections
  const h2Regex = /<h2[^>]*>/gi;
  const h2Matches: number[] = [];
  let match;
  while ((match = h2Regex.exec(html)) !== null) {
    h2Matches.push(match.index);
  }

  if (h2Matches.length < 2) return html;

  // Distribute images evenly between H2 sections (skip first H2 - intro)
  const insertPositions: number[] = [];
  const sectionCount = h2Matches.length - 1;
  const step = Math.max(1, Math.floor(sectionCount / (inlineImages.length + 1)));

  for (let i = 0; i < inlineImages.length && i * step + 1 < h2Matches.length; i++) {
    insertPositions.push(h2Matches[i * step + 1]);
  }

  // Insert images from last to first to preserve positions
  let result = html;
  for (let i = insertPositions.length - 1; i >= 0; i--) {
    if (i < inlineImages.length) {
      const img = inlineImages[i];
      const imgHtml = `\n<figure class="wp-block-image size-large"><img src="${img.wpUrl}" alt="${img.altText.replace(/"/g, "&quot;")}" class="wp-image-${img.wpMediaId}" /><figcaption>${img.altText}</figcaption></figure>\n\n`;
      result = result.slice(0, insertPositions[i]) + imgHtml + result.slice(insertPositions[i]);
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, categoryIds, status: postStatus, images, blogId } = await req.json() as {
      articleId: string;
      categoryIds?: number[];
      status?: string;
      images?: Array<{ type: string; altText: string; b64: string }>;
      blogId?: string;
    };

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    // Get WordPress credentials
    const { data: settings } = await supabase
      .from("user_settings")
      .select("wp_url, wp_username, wp_app_password, wp_blogs")
      .eq("user_id", user.id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: "No blogs connected. Add a blog in Settings." }, { status: 400 });
    }

    // Get the article (also check for wp_blog_id to use that blog)
    const { data: article } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const effectiveBlogId = blogId || article.wp_blog_id || undefined;
    const creds = getBlogCredentials(settings, effectiveBlogId);
    if (!creds) {
      return NextResponse.json({ error: "No blogs connected. Add a blog in Settings." }, { status: 400 });
    }

    const wpUrl = creds.wpUrl;
    const auth = creds.auth;

    // Upload images to WordPress media library if provided
    const uploadedImages: ImageUploadResult[] = [];
    let featuredMediaId: number | null = null;

    if (images && images.length > 0) {
      const slug = article.slug || "article";
      const uploadResults = await Promise.all(
        images.map((img, i) =>
          uploadImageToWP(
            wpUrl,
            auth,
            img.b64,
            `${slug}-${i === 0 ? "featured" : `image-${i}`}`,
            img.altText
          ).then((result) =>
            result
              ? { wpMediaId: result.mediaId, wpUrl: result.url, altText: img.altText, type: img.type }
              : null
          )
        )
      );

      for (const result of uploadResults) {
        if (result) {
          uploadedImages.push(result);
          if (result.type === "Featured Image") {
            featuredMediaId = result.wpMediaId;
          }
        }
      }
    }

    // Convert markdown to HTML
    let htmlContent = await marked(article.article_markdown || "");

    // Inject inline images into the HTML
    if (uploadedImages.length > 0) {
      htmlContent = injectImagesIntoHtml(htmlContent, uploadedImages);
    }

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

    if (featuredMediaId) {
      postPayload.featured_media = featuredMediaId;
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
      imagesUploaded: uploadedImages.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
