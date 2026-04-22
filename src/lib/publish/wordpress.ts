import { marked } from "marked";
import { decryptCredential } from "@/lib/wp-crypto";
import { logPublishEvent } from "@/lib/publish-log";
import { downloadImage } from "@/lib/supabase-admin";
import { validatePublicUrl } from "@/lib/ssrf";
import { logger } from "@/lib/logger";
import type {
  PublishHelperArgs,
  PublishResult,
  WordpressPublishOptions,
} from "./index";

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

interface ImageUploadResult {
  wpMediaId: number;
  wpUrl: string;
  altText: string;
  type: string;
}

function getBlogCredentials(
  settings: Record<string, unknown>,
  blogId?: string,
): { wpUrl: string; auth: string } | null {
  const blogs = settings.wp_blogs as WpBlog[] | null;

  if (blogs && Array.isArray(blogs) && blogs.length > 0) {
    const blog = blogId ? blogs.find((b) => b.id === blogId) : blogs[0];
    if (blog?.url && blog?.username && blog?.appPassword) {
      return {
        wpUrl: blog.url.replace(/\/$/, ""),
        auth: Buffer.from(
          `${blog.username}:${decryptCredential(blog.appPassword)}`,
        ).toString("base64"),
      };
    }
  }

  if (settings.wp_url && settings.wp_username && settings.wp_app_password) {
    return {
      wpUrl: (settings.wp_url as string).replace(/\/$/, ""),
      auth: Buffer.from(
        `${settings.wp_username}:${decryptCredential(settings.wp_app_password as string)}`,
      ).toString("base64"),
    };
  }

  return null;
}

async function uploadImageToWP(
  wpUrl: string,
  auth: string,
  imageBuffer: Buffer,
  filename: string,
  altText: string,
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
      return {
        mediaId: 0,
        url: "",
        error: `Upload failed (${uploadRes.status}): ${errBody.slice(0, 200)}`,
      };
    }

    const media = (await uploadRes.json()) as { id: number; source_url: string };

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
    return {
      mediaId: 0,
      url: "",
      error: err instanceof Error ? err.message : "Unknown upload error",
    };
  }
}

function injectImagesIntoHtml(html: string, images: ImageUploadResult[]): string {
  const inlineImages = images.filter((img) => img.type !== "Featured Image");
  if (inlineImages.length === 0) return html;

  const h2Regex = /<h2[^>]*>/gi;
  const h2Matches: number[] = [];
  let match;
  while ((match = h2Regex.exec(html)) !== null) {
    h2Matches.push(match.index);
  }

  if (h2Matches.length < 2) return html;

  const insertPositions: number[] = [];
  const sectionCount = h2Matches.length - 1;
  const step = Math.max(1, Math.floor(sectionCount / (inlineImages.length + 1)));

  for (let i = 0; i < inlineImages.length && i * step + 1 < h2Matches.length; i++) {
    insertPositions.push(h2Matches[i * step + 1]);
  }

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

export async function publishToWordpress(
  args: PublishHelperArgs,
  options: WordpressPublishOptions = {},
): Promise<PublishResult> {
  const { admin, userId, articleId, platformAccountId } = args;
  const { categoryIds, status: postStatus, includeImages } = options;

  try {
    const { data: settings } = await admin
      .from("user_settings")
      .select("wp_url, wp_username, wp_app_password, wp_blogs")
      .eq("user_id", userId)
      .single();

    if (!settings) {
      return {
        success: false,
        platform: "wordpress",
        error: "No blogs connected. Add a blog in Settings.",
      };
    }

    const { data: article } = await admin
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", userId)
      .single();

    if (!article) {
      return { success: false, platform: "wordpress", error: "Article not found" };
    }

    const effectiveBlogId = platformAccountId || article.wp_blog_id || undefined;
    const creds = getBlogCredentials(settings, effectiveBlogId);
    if (!creds) {
      return {
        success: false,
        platform: "wordpress",
        error: "No blogs connected. Add a blog in Settings.",
      };
    }

    const wpUrl = creds.wpUrl;
    const auth = creds.auth;

    try {
      validatePublicUrl(wpUrl);
    } catch (e) {
      return {
        success: false,
        platform: "wordpress",
        accountName: wpUrl,
        error: `Invalid WordPress URL: ${(e as Error).message}`,
      };
    }

    const uploadedImages: ImageUploadResult[] = [];
    let featuredMediaId: number | null = null;
    const imageErrors: string[] = [];
    const storedImages = (article.generated_images as StoredImage[]) || [];
    const imagesToProcess =
      includeImages !== false
        ? storedImages.filter((i) => i.success && i.storagePath)
        : [];

    if (imagesToProcess.length > 0) {
      const slug = article.slug || "article";

      for (let i = 0; i < imagesToProcess.length; i++) {
        const img = imagesToProcess[i];
        try {
          const buffer = await downloadImage(img.storagePath);
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
          imageErrors.push(
            `${img.type}: ${err instanceof Error ? err.message : "Download failed"}`,
          );
        }
      }

      if (imagesToProcess.length > 0 && uploadedImages.length === 0) {
        return {
          success: false,
          platform: "wordpress",
          accountName: wpUrl,
          error: `All image uploads failed. ${imageErrors[0] || "Check WordPress media upload permissions."}`,
        };
      }
    }

    let htmlContent = await marked(article.article_markdown || "");

    if (uploadedImages.length > 0) {
      htmlContent = injectImagesIntoHtml(htmlContent, uploadedImages);
    }

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
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          platform: "wordpress",
          accountName: wpUrl,
          error: `WordPress authentication failed (${res.status}). Check credentials in Settings for this blog.`,
        };
      }
      return {
        success: false,
        platform: "wordpress",
        accountName: wpUrl,
        error: data.message || `WordPress error (${res.status})`,
      };
    }

    const post = (await res.json()) as { id: number; link: string };

    await admin
      .from("articles")
      .update({ posted: true, updated_at: new Date().toISOString() })
      .eq("id", articleId)
      .eq("user_id", userId);

    const editUrl = `${wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`;

    await logPublishEvent(admin, {
      userId,
      articleId,
      platform: "wordpress",
      accountName: wpUrl,
      postId: String(post.id),
      postUrl: post.link,
      editUrl,
    });

    return {
      success: true,
      platform: "wordpress",
      accountName: wpUrl,
      postId: String(post.id),
      postUrl: post.link,
      editUrl,
    };
  } catch (error: unknown) {
    logger.error("Failed to publish to WordPress", error);
    return {
      success: false,
      platform: "wordpress",
      error: "Failed to publish to WordPress",
    };
  }
}
