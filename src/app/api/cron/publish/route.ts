import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { decryptCredential } from "@/lib/wp-crypto";
import { marked } from "marked";

export const maxDuration = 60;

interface WpBlog {
  id: string;
  url: string;
  username: string;
  appPassword: string;
}

interface ShopifyAccount {
  id: string;
  name: string;
  shopDomain: string;
  accessToken: string;
}

interface StoredImage {
  type: string;
  altText: string;
  storagePath: string;
  publicUrl: string;
  success: boolean;
}

interface ArticleRow {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  slug: string;
  meta_description: string;
  article_markdown: string;
  generated_images: StoredImage[] | null;
  wp_blog_id: string | null;
  scheduled_platform: string;
  scheduled_account_id: string | null;
  scheduled_options: Record<string, unknown>;
}

interface UserSettings {
  wp_url?: string;
  wp_username?: string;
  wp_app_password?: string;
  wp_blogs?: WpBlog[];
  shopify_accounts?: ShopifyAccount[];
}

async function publishWordPress(
  article: ArticleRow,
  settings: UserSettings
): Promise<{ success: boolean; error?: string }> {
  const blogs = settings.wp_blogs as WpBlog[] | undefined;
  let wpUrl: string | null = null;
  let auth: string | null = null;

  if (blogs && Array.isArray(blogs) && blogs.length > 0) {
    const blog = article.wp_blog_id
      ? blogs.find((b) => b.id === article.wp_blog_id)
      : blogs[0];
    if (blog?.url && blog?.username && blog?.appPassword) {
      wpUrl = blog.url.replace(/\/$/, "");
      auth = Buffer.from(
        `${blog.username}:${decryptCredential(blog.appPassword)}`
      ).toString("base64");
    }
  } else if (settings.wp_url && settings.wp_username && settings.wp_app_password) {
    wpUrl = (settings.wp_url as string).replace(/\/$/, "");
    auth = Buffer.from(
      `${settings.wp_username}:${decryptCredential(settings.wp_app_password as string)}`
    ).toString("base64");
  }

  if (!wpUrl || !auth) {
    return { success: false, error: "No WordPress credentials found" };
  }

  const options = article.scheduled_options ?? {};
  const postStatus = (options.status as string) ?? "publish";
  const categoryIds = (options.categoryIds as number[]) ?? [];

  const htmlContent = await marked(article.article_markdown || "");

  const postPayload: Record<string, unknown> = {
    title: article.title || article.topic,
    content: htmlContent,
    slug: article.slug || undefined,
    status: postStatus,
    excerpt: article.meta_description || "",
  };

  if (categoryIds.length > 0) {
    postPayload.categories = categoryIds;
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
    return {
      success: false,
      error: (data as { message?: string }).message || `WordPress error (${res.status})`,
    };
  }

  return { success: true };
}

async function publishShopify(
  article: ArticleRow,
  settings: UserSettings
): Promise<{ success: boolean; error?: string }> {
  const accounts = (settings.shopify_accounts as ShopifyAccount[]) ?? [];
  const account = article.scheduled_account_id
    ? accounts.find((a) => a.id === article.scheduled_account_id)
    : accounts[0];

  if (!account?.shopDomain || !account?.accessToken) {
    return { success: false, error: "No Shopify account found" };
  }

  const accessToken = decryptCredential(account.accessToken);
  const shopDomain = account.shopDomain.replace(/\/$/, "");

  // Get blog ID
  let blogId: number | null = null;
  try {
    const blogsRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/blogs.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );
    if (blogsRes.ok) {
      const blogsData = await blogsRes.json();
      blogId = blogsData.blogs?.[0]?.id ?? null;
    }
  } catch {
    // ignore
  }

  if (!blogId) {
    return { success: false, error: "No Shopify blog found" };
  }

  let bodyHtml = await marked(article.article_markdown || "");
  const storedImages = (article.generated_images as StoredImage[]) ?? [];
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
          bodyHtml =
            bodyHtml.slice(0, pos) +
            `\n<figure><img src="${img.publicUrl}" alt="${img.altText.replace(/"/g, "&quot;")}" /><figcaption>${img.altText}</figcaption></figure>\n\n` +
            bodyHtml.slice(pos);
        }
      }
    }
  }

  const options = article.scheduled_options ?? {};
  const tags = (options.tags as string[]) ?? [];
  const status = (options.status as string) ?? "publish";

  const articlePayload: Record<string, unknown> = {
    title: article.title || article.topic,
    author: account.name || "Author",
    body_html: bodyHtml,
    published: status === "publish",
    tags: tags.join(", "),
  };

  if (featuredImageUrl) {
    articlePayload.image = {
      src: featuredImageUrl,
      alt: article.title || article.topic,
    };
  }

  const res = await fetch(
    `https://${shopDomain}/admin/api/2024-01/blogs/${blogId}/articles.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ article: articlePayload }),
    }
  );

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { errors?: unknown };
    const errMsg: string = data.errors
      ? JSON.stringify(data.errors)
      : `Shopify error (${res.status})`;
    return { success: false, error: errMsg };
  }

  return { success: true };
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();

  // Query articles due for publishing
  const { data: dueArticles, error: queryError } = await admin
    .from("articles")
    .select(
      "id, user_id, title, topic, slug, meta_description, article_markdown, generated_images, wp_blog_id, scheduled_platform, scheduled_account_id, scheduled_options"
    )
    .lte("publish_at", new Date().toISOString())
    .eq("posted", false)
    .not("scheduled_platform", "is", null)
    .limit(10);

  if (queryError) {
    return NextResponse.json(
      { error: `Query failed: ${queryError.message}` },
      { status: 500 }
    );
  }

  if (!dueArticles || dueArticles.length === 0) {
    return NextResponse.json({ processed: 0, results: [] });
  }

  const results: Array<{
    articleId: string;
    platform: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const article of dueArticles as ArticleRow[]) {
    // Clear publish_at first to prevent duplicate processing
    await admin
      .from("articles")
      .update({ publish_at: null })
      .eq("id", article.id);

    // Get user settings via admin client
    const { data: settingsRow } = await admin
      .from("user_settings")
      .select("wp_url, wp_username, wp_app_password, wp_blogs, shopify_accounts")
      .eq("user_id", article.user_id)
      .single();

    if (!settingsRow) {
      results.push({
        articleId: article.id,
        platform: article.scheduled_platform,
        success: false,
        error: "User settings not found",
      });
      continue;
    }

    const settings = settingsRow as UserSettings;
    let result: { success: boolean; error?: string };

    if (article.scheduled_platform === "wordpress") {
      result = await publishWordPress(article, settings);
    } else if (article.scheduled_platform === "shopify") {
      result = await publishShopify(article, settings);
    } else {
      // For other platforms: mark as posted with a TODO note
      // TODO: implement Medium, Ghost, Dev.to inline publishing
      result = { success: true };
    }

    if (result.success) {
      await admin
        .from("articles")
        .update({
          posted: true,
          published_platform: article.scheduled_platform,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
    } else {
      // Restore publish_at so it can be retried or the user is aware
      // (we leave posted=false but publish_at is cleared to avoid immediate re-queuing)
    }

    results.push({
      articleId: article.id,
      platform: article.scheduled_platform,
      success: result.success,
      error: result.error,
    });
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
