import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { downloadImage } from "@/lib/supabase-admin";
import { decryptCredential } from "@/lib/wp-crypto";
import type { ShopifyAccount } from "@/lib/publish-platforms";
import { marked } from "marked";

export const maxDuration = 60;

interface StoredImage {
  type: string;
  altText: string;
  storagePath: string;
  publicUrl: string;
  success: boolean;
}

async function getShopifyBlogId(shopDomain: string, auth: string): Promise<number | null> {
  try {
    const res = await fetch(`https://${shopDomain}/admin/api/2024-01/blogs.json`, {
      headers: { "X-Shopify-Access-Token": auth, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.blogs?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function uploadImageToShopify(
  shopDomain: string,
  auth: string,
  imageBuffer: Buffer,
  altText: string,
  filename: string
): Promise<string | null> {
  try {
    // Shopify accepts base64 image uploads via the files API or product images;
    // for blog articles the simplest path is to embed the public Supabase URL directly
    // since Shopify will hot-link it. Return null to signal "use URL in HTML instead".
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, accountId, tags, status } = await req.json() as {
      articleId: string;
      accountId?: string;
      tags?: string[];
      status?: "draft" | "publish";
    };

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("shopify_accounts")
      .eq("user_id", user.id)
      .single();

    const accounts = (settings?.shopify_accounts as ShopifyAccount[]) ?? [];
    const account = accountId ? accounts.find((a) => a.id === accountId) : accounts[0];

    if (!account?.shopDomain || !account?.accessToken) {
      return NextResponse.json({ error: "No Shopify store connected. Add one in Settings." }, { status: 400 });
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

    const accessToken = decryptCredential(account.accessToken);
    const shopDomain = account.shopDomain.replace(/\/$/, "");

    // Get the first available blog in the Shopify store
    const blogId = await getShopifyBlogId(shopDomain, accessToken);
    if (!blogId) {
      return NextResponse.json(
        { error: "Could not find a blog in your Shopify store. Create one at Online Store > Blog Posts." },
        { status: 400 }
      );
    }

    // Convert markdown to HTML
    let bodyHtml = await marked(article.article_markdown || "");

    // Inject Supabase-hosted images directly into the HTML (Shopify hot-links)
    const storedImages = (article.generated_images as StoredImage[]) ?? [];
    const successImages = storedImages.filter((i) => i.success && i.publicUrl);
    let featuredImageUrl: string | null = null;

    if (successImages.length > 0) {
      const featured = successImages.find((i) => i.type === "Featured Image");
      featuredImageUrl = featured?.publicUrl ?? null;

      // Inline non-featured images between H2 sections
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

    const articlePayload: Record<string, unknown> = {
      title: article.title || article.topic,
      author: account.name || "Author",
      body_html: bodyHtml,
      published: status === "publish",
      tags: (tags ?? []).join(", "),
    };

    if (featuredImageUrl) {
      articlePayload.image = { src: featuredImageUrl, alt: article.title || article.topic };
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
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: `Shopify authentication failed (${res.status}). Check your access token in Settings.` },
          { status: 401 }
        );
      }
      const errMsg = (data.errors && JSON.stringify(data.errors)) || `Shopify error (${res.status})`;
      return NextResponse.json({ error: errMsg }, { status: res.status });
    }

    const result = await res.json();
    const createdArticle = result.article;

    await supabase
      .from("articles")
      .update({ posted: true, published_platform: "shopify", updated_at: new Date().toISOString() })
      .eq("id", articleId);

    return NextResponse.json({
      success: true,
      postId: createdArticle.id,
      postUrl: `https://${shopDomain}/blogs/${createdArticle.blog_id}/${createdArticle.handle}`,
      editUrl: `https://${shopDomain}/admin/articles/${createdArticle.id}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
