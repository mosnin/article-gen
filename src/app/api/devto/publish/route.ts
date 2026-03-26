import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import type { DevToAccount } from "@/lib/publish-platforms";
import { logPublishEvent } from "@/lib/publish-log";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

/** Dev.to tags: lowercase, no spaces or special chars, max 4 tags */
function sanitizeDevToTags(tags: string[]): string[] {
  return tags
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 0 && t.length <= 30)
    .slice(0, 4);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, accountId, tags, published, canonicalUrl } = await req.json() as {
      articleId: string;
      accountId?: string;
      tags?: string[];
      published?: boolean;
      canonicalUrl?: string;
    };

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("devto_accounts")
      .eq("user_id", user.id)
      .single();

    const accounts = (settings?.devto_accounts as DevToAccount[]) ?? [];
    const account = accountId ? accounts.find((a) => a.id === accountId) : accounts[0];

    if (!account?.apiKey) {
      return NextResponse.json({ error: "No Dev.to account connected. Add one in Settings." }, { status: 400 });
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

    const apiKey = decryptCredential(account.apiKey);
    const devtoTags = sanitizeDevToTags(tags ?? []);

    const articlePayload: Record<string, unknown> = {
      title: article.title || article.topic,
      body_markdown: article.article_markdown || "",
      published: published ?? false,
      tags: devtoTags,
    };

    if (canonicalUrl) {
      articlePayload.canonical_url = canonicalUrl;
    }

    const res = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ article: articlePayload }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        return NextResponse.json(
          { error: "Dev.to authentication failed. Check your API key in Settings." },
          { status: 401 }
        );
      }
      const errMsg =
        (Array.isArray(data.error) ? data.error.join(", ") : data.error) ||
        `Dev.to error (${res.status})`;
      return NextResponse.json({ error: errMsg }, { status: res.status });
    }

    const result = await res.json();

    await supabase
      .from("articles")
      .update({ posted: true, published_platform: "devto", updated_at: new Date().toISOString() })
      .eq("id", articleId);

    await logPublishEvent(supabase, {
      userId: user.id,
      articleId,
      platform: "devto",
      accountName: account.name,
      postId: String(result.id),
      postUrl: result.url,
      editUrl: "https://dev.to/dashboard",
    });

    return NextResponse.json({ success: true, postId: result.id, postUrl: result.url, editUrl: "https://dev.to/dashboard" });
  } catch (error: unknown) {
    logger.error("Failed to publish to Dev.to", error);
    return NextResponse.json({ error: "Failed to publish to Dev.to" }, { status: 500 });
  }
}
