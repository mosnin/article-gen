import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { downloadImage } from "@/lib/supabase-admin";
import { marked } from "marked";
import { decryptCredential } from "@/lib/wp-crypto";
import { logPublishEvent } from "@/lib/publish-log";
import { validatePublicUrl } from "@/lib/ssrf";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

interface WpBlog {
  id: string;
  url: string;
  username: string;
  appPassword: string;
}

interface StoredImage {
  type: string;
  altText: string;
  storagePath: string;
  publicUrl: string;
  success: boolean;
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

  if (settings.wp_url && settings.wp_username && settings.wp_app_password) {
    return {
      wpUrl: (settings.wp_url as string).replace(/\/$/, ""),
      auth: Buffer.from(`${settings.wp_username}:${decryptCredential(settings.wp_app_password as string)}`).toString("base64"),
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
  imageBuffer: Buffer,
  filename: string,
  altText: string
): Promise<{ mediaId: number; url: string } | { mediaId: 0; url: ""; error: string }> {
  try {
    const uploadRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}.png"`,
        "User-Agent": "ArticleSauce/1.0",
      },
      body: new Uint8Array(imageBuffer),
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text().catch(() => "");
      return { mediaId: 0, url: "", error: `Upload failed (${uploadRes.status}): ${errBody.slice(0, 200)}` };
    }

    const media = await uploadRes.json();

    // Set alt text
    if (altText) {
      await fetch(`${wpUrl}/wp-json/wp/v2/media/${media.id}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          "User-Agent": "ArticleSauce/1.0",
        },
        body: JSON.stringify({ alt_text: altText }),
      });
    }

    return { mediaId: media.id, url: media.source_url };
  } catch (err) {
    return { mediaId: 0, url: "", error: err instanceof Error ? err.message : "Unknown upload error" };
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

    const { articleId, categoryIds, status: postStatus, includeImages, blogId } = await req.json() as {
      articleId: string;
      categoryIds?: number[];
      status?: string;
      includeImages?: boolean;
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

    // Get the article with generated_images
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

    // Validate WordPress URL to prevent SSRF
    try {
      validatePublicUrl(wpUrl);
    } catch (e) {
      return NextResponse.json(
        { error: `Invalid WordPress URL: ${(e as Error).message}` },
        { status: 400 }
      );
    }

    // Upload images from Supabase Storage to WordPress
    const uploadedImages: ImageUploadResult[] = [];
    let featuredMediaId: number | null = null;
    const imageErrors: string[] = [];
    const storedImages = (article.generated_images as StoredImage[]) || [];
    const imagesToProcess = includeImages !== false ? storedImages.filter((i) => i.success && i.storagePath) : [];

    if (imagesToProcess.length > 0) {
      const slug = article.slug || "article";

      for (let i = 0; i < imagesToProcess.length; i++) {
        const img = imagesToProcess[i];
        try {
          // Download from Supabase Storage
          const buffer = await downloadImage(img.storagePath);

          // Upload to WordPress
          const filename = `${slug}-${i === 0 ? "featured" : `image-${i}`}`;
          const result = await uploadImageToWP(wpUrl, auth, buffer, filename, img.altText);

          if (result.mediaId && result.url) {
            const uploaded: ImageUploadResult = {
              wpMediaId: result.mediaId,
              wpUrl: result.url,
              altText: img.altText,
              type: img.type,
            };
            uploadedImages.push(uploaded);
            if (img.type === "Featured Image") {
              featuredMediaId = uploaded.wpMediaId;
            }
          } else if ("error" in result) {
            imageErrors.push(`${img.type}: ${result.error}`);
          }
        } catch (err) {
          imageErrors.push(`${img.type}: ${err instanceof Error ? err.message : "Download failed"}`);
        }
      }

      // If all image uploads failed, return error
      if (imagesToProcess.length > 0 && uploadedImages.length === 0) {
        return NextResponse.json(
          { error: `All image uploads failed. ${imageErrors[0] || "Check WordPress media upload permissions."}` },
          { status: 502 }
        );
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
        "User-Agent": "ArticleSauce/1.0",
      },
      body: JSON.stringify(postPayload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: `WordPress authentication failed (${res.status}). Check credentials in Settings for this blog.` },
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

    await logPublishEvent(supabase, {
      userId: user.id,
      articleId,
      platform: "wordpress",
      accountName: wpUrl,
      postId: String(post.id),
      postUrl: post.link,
      editUrl: `${wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
    });

    return NextResponse.json({
      success: true,
      postId: post.id,
      postUrl: post.link,
      editUrl: `${wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
      imagesUploaded: uploadedImages.length,
      imageErrors: imageErrors.length > 0 ? imageErrors : undefined,
    });
  } catch (error: unknown) {
    logger.error("Failed to publish to WordPress", error);
    return NextResponse.json({ error: "Failed to publish to WordPress" }, { status: 500 });
  }
}
