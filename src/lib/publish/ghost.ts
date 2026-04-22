import { marked } from "marked";
import { decryptCredential } from "@/lib/wp-crypto";
import { createGhostJwt } from "@/lib/publish-platforms";
import type { GhostBlog } from "@/lib/publish-platforms";
import { logPublishEvent } from "@/lib/publish-log";
import { safeFetch, validatePublicUrl } from "@/lib/ssrf";
import { logger } from "@/lib/logger";
import type { GhostPublishOptions, PublishHelperArgs, PublishResult } from "./index";

interface StoredImage {
  type: string;
  altText: string;
  storagePath: string;
  publicUrl: string;
  success: boolean;
}

interface GhostPostResponse {
  id: string;
  url: string;
}

export async function publishToGhost(
  args: PublishHelperArgs,
  options: GhostPublishOptions = {},
): Promise<PublishResult> {
  const { admin, userId, articleId, platformAccountId } = args;
  const { tags, status } = options;

  try {
    const { data: settings } = await admin
      .from("user_settings")
      .select("ghost_blogs")
      .eq("user_id", userId)
      .single();

    const blogs = (settings?.ghost_blogs as GhostBlog[] | undefined) ?? [];
    const blog = platformAccountId
      ? blogs.find((b) => b.id === platformAccountId)
      : blogs[0];

    if (!blog?.url || !blog?.adminApiKey) {
      return {
        success: false,
        platform: "ghost",
        error: "No Ghost blog connected. Add one in Settings.",
      };
    }

    const { data: article } = await admin
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", userId)
      .single();

    if (!article) {
      return {
        success: false,
        platform: "ghost",
        accountName: blog.name || blog.url,
        error: "Article not found",
      };
    }

    const adminApiKey = decryptCredential(blog.adminApiKey);
    const ghostUrl = blog.url.replace(/\/$/, "");

    try {
      validatePublicUrl(ghostUrl);
    } catch (e) {
      return {
        success: false,
        platform: "ghost",
        accountName: blog.name || blog.url,
        error: `Invalid Ghost blog URL: ${(e as Error).message}`,
      };
    }

    let jwt: string;
    try {
      jwt = createGhostJwt(adminApiKey);
    } catch {
      return {
        success: false,
        platform: "ghost",
        accountName: blog.name || blog.url,
        error:
          "Invalid Ghost Admin API key format. It should be 'id:secret' from Ghost Admin > Integrations.",
      };
    }

    const html = await marked(article.article_markdown || "");

    const storedImages = (article.generated_images as StoredImage[] | undefined) ?? [];
    const featuredImage = storedImages.find(
      (i) => i.success && i.publicUrl && i.type === "Featured Image",
    );

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

    const res = await safeFetch(`${ghostUrl}/ghost/api/admin/posts/`, {
      method: "POST",
      headers: {
        Authorization: `Ghost ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ posts: [postPayload] }),
      timeoutMs: 20_000,
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        errors?: Array<{ message?: string; context?: string }>;
      };
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          platform: "ghost",
          accountName: blog.name || blog.url,
          error: `Ghost authentication failed (${res.status}). Check your Admin API key in Settings.`,
        };
      }
      const errMsg =
        data.errors?.[0]?.message ||
        data.errors?.[0]?.context ||
        `Ghost error (${res.status})`;
      return {
        success: false,
        platform: "ghost",
        accountName: blog.name || blog.url,
        error: errMsg,
      };
    }

    const result = (await res.json()) as { posts?: GhostPostResponse[] };
    const post = result.posts?.[0];
    if (!post) {
      return {
        success: false,
        platform: "ghost",
        accountName: blog.name || blog.url,
        error: "Ghost returned no post",
      };
    }

    const editUrl = `${ghostUrl}/ghost/#/editor/post/${post.id}`;

    await admin
      .from("articles")
      .update({
        posted: true,
        published_platform: "ghost",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .eq("user_id", userId);

    await logPublishEvent(admin, {
      userId,
      articleId,
      platform: "ghost",
      accountName: blog.name || blog.url,
      postId: post.id,
      postUrl: post.url,
      editUrl,
    });

    return {
      success: true,
      platform: "ghost",
      accountName: blog.name || blog.url,
      postId: post.id,
      postUrl: post.url,
      editUrl,
    };
  } catch (error: unknown) {
    logger.error("Failed to publish to Ghost", error);
    return {
      success: false,
      platform: "ghost",
      error: "Failed to publish to Ghost",
    };
  }
}
