import { marked } from "marked";
import { decryptCredential } from "@/lib/wp-crypto";
import type { ShopifyAccount } from "@/lib/publish-platforms";
import { logPublishEvent } from "@/lib/publish-log";
import { safeFetch } from "@/lib/ssrf";
import { logger } from "@/lib/logger";
import type { PublishHelperArgs, PublishResult, ShopifyPublishOptions } from "./index";

interface StoredImage {
  type: string;
  altText: string;
  storagePath: string;
  publicUrl: string;
  success: boolean;
}

interface ShopifyBlogsResponse {
  blogs?: Array<{ id?: number }>;
}

interface ShopifyArticleResponse {
  article?: { id: number; blog_id: number; handle: string };
}

/** Validates that the shopDomain looks like a myshopify.com domain or custom domain
 *  but is NOT a private/internal host. Also rejects bare IPs. */
function validateShopDomain(domain: string): void {
  if (domain.includes("/") || domain.includes("://")) {
    throw new Error("Invalid shop domain format");
  }
  const lower = domain.toLowerCase();
  if (
    lower === "localhost" ||
    lower.startsWith("127.") ||
    lower.startsWith("10.") ||
    lower.startsWith("192.168.") ||
    lower === "::1"
  ) {
    throw new Error("Shop domain resolves to a blocked host");
  }
}

async function getShopifyBlogId(
  shopDomain: string,
  auth: string,
): Promise<number | null> {
  try {
    const res = await safeFetch(
      `https://${shopDomain}/admin/api/2024-01/blogs.json`,
      {
        headers: {
          "X-Shopify-Access-Token": auth,
          "Content-Type": "application/json",
        },
        timeoutMs: 10_000,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ShopifyBlogsResponse;
    return data.blogs?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function publishToShopify(
  args: PublishHelperArgs,
  options: ShopifyPublishOptions = {},
): Promise<PublishResult> {
  const { admin, userId, articleId, platformAccountId } = args;
  const { tags, status } = options;

  try {
    const { data: settings } = await admin
      .from("user_settings")
      .select("shopify_accounts")
      .eq("user_id", userId)
      .single();

    const accounts = (settings?.shopify_accounts as ShopifyAccount[] | undefined) ?? [];
    const account = platformAccountId
      ? accounts.find((a) => a.id === platformAccountId)
      : accounts[0];

    if (!account?.shopDomain || !account?.accessToken) {
      return {
        success: false,
        platform: "shopify",
        error: "No Shopify store connected. Add one in Settings.",
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
        platform: "shopify",
        accountName: account.name || account.shopDomain,
        error: "Article not found",
      };
    }

    const accessToken = decryptCredential(account.accessToken);
    const shopDomain = account.shopDomain.replace(/\/$/, "");

    try {
      validateShopDomain(shopDomain);
    } catch (e) {
      return {
        success: false,
        platform: "shopify",
        accountName: account.name || account.shopDomain,
        error: `Invalid Shopify domain: ${(e as Error).message}`,
      };
    }

    const blogId = await getShopifyBlogId(shopDomain, accessToken);
    if (!blogId) {
      return {
        success: false,
        platform: "shopify",
        accountName: account.name || account.shopDomain,
        error:
          "Could not find a blog in your Shopify store. Create one at Online Store > Blog Posts.",
      };
    }

    let bodyHtml = await marked(article.article_markdown || "");

    const storedImages = (article.generated_images as StoredImage[] | undefined) ?? [];
    const successImages = storedImages.filter((i) => i.success && i.publicUrl);
    let featuredImageUrl: string | null = null;

    if (successImages.length > 0) {
      const featured = successImages.find((i) => i.type === "Featured Image");
      featuredImageUrl = featured?.publicUrl ?? null;

      const inlineImgs = successImages.filter((i) => i.type !== "Featured Image");
      if (inlineImgs.length > 0) {
        const h2Regex = /<h2[^>]*>/gi;
        const positions: number[] = [];
        let m;
        while ((m = h2Regex.exec(bodyHtml)) !== null) positions.push(m.index);
        if (positions.length >= 2) {
          for (let i = inlineImgs.length - 1; i >= 0; i--) {
            const pos = positions[Math.min(i + 1, positions.length - 1)];
            const img = inlineImgs[i];
            const safeAlt = img.altText.replace(
              /[<>"'&]/g,
              (c) =>
                ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;" }[c] ??
                  c),
            );
            bodyHtml =
              bodyHtml.slice(0, pos) +
              `\n<figure><img src="${img.publicUrl}" alt="${safeAlt}" /><figcaption>${safeAlt}</figcaption></figure>\n\n` +
              bodyHtml.slice(pos);
          }
        }
      }
    }

    const articlePayload: Record<string, unknown> = {
      title: article.title || article.topic,
      author: account.name || "Author",
      body_html: bodyHtml,
      published: status === "publish",
      tags: (tags ?? []).join(", "),
    };

    if (featuredImageUrl) {
      articlePayload.image = {
        src: featuredImageUrl,
        alt: article.title || article.topic,
      };
    }

    const res = await safeFetch(
      `https://${shopDomain}/admin/api/2024-01/blogs/${blogId}/articles.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article: articlePayload }),
        timeoutMs: 20_000,
      },
    );

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { errors?: unknown };
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          platform: "shopify",
          accountName: account.name || account.shopDomain,
          error: `Shopify authentication failed (${res.status}). Check your access token in Settings.`,
        };
      }
      const errMsg: string = data.errors
        ? JSON.stringify(data.errors)
        : `Shopify error (${res.status})`;
      return {
        success: false,
        platform: "shopify",
        accountName: account.name || account.shopDomain,
        error: errMsg,
      };
    }

    const result = (await res.json()) as ShopifyArticleResponse;
    const createdArticle = result.article;
    if (!createdArticle) {
      return {
        success: false,
        platform: "shopify",
        accountName: account.name || account.shopDomain,
        error: "Shopify returned no article",
      };
    }

    const postUrl = `https://${shopDomain}/blogs/${createdArticle.blog_id}/${createdArticle.handle}`;
    const editUrl = `https://${shopDomain}/admin/articles/${createdArticle.id}`;

    await admin
      .from("articles")
      .update({
        posted: true,
        published_platform: "shopify",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .eq("user_id", userId);

    await logPublishEvent(admin, {
      userId,
      articleId,
      platform: "shopify",
      accountName: account.name || account.shopDomain,
      postId: String(createdArticle.id),
      postUrl,
      editUrl,
    });

    return {
      success: true,
      platform: "shopify",
      accountName: account.name || account.shopDomain,
      postId: String(createdArticle.id),
      postUrl,
      editUrl,
    };
  } catch (error: unknown) {
    logger.error("Failed to publish to Shopify", error);
    return {
      success: false,
      platform: "shopify",
      error: "Failed to publish to Shopify",
    };
  }
}
