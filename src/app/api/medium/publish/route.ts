import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import type { MediumAccount } from "@/lib/publish-platforms";
import { logPublishEvent } from "@/lib/publish-log";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, accountId, tags, status, canonicalUrl } = await req.json() as {
      articleId: string;
      accountId?: string;
      tags?: string[];
      status?: "draft" | "public" | "unlisted";
      canonicalUrl?: string;
    };

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("medium_accounts")
      .eq("user_id", user.id)
      .single();

    const accounts = (settings?.medium_accounts as MediumAccount[]) ?? [];
    const account = accountId ? accounts.find((a) => a.id === accountId) : accounts[0];

    if (!account?.integrationToken) {
      return NextResponse.json({ error: "No Medium account connected. Add one in Settings." }, { status: 400 });
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

    const token = decryptCredential(account.integrationToken);

    // Get Medium user ID
    const meRes = await fetch("https://api.medium.com/v1/me", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!meRes.ok) {
      if (meRes.status === 401) {
        return NextResponse.json(
          { error: "Medium authentication failed. Check your integration token in Settings." },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: `Medium API error (${meRes.status})` }, { status: meRes.status });
    }

    const meData = await meRes.json();
    const userId = meData.data?.id;
    if (!userId) {
      return NextResponse.json({ error: "Could not retrieve Medium user ID." }, { status: 500 });
    }

    // Medium accepts markdown directly
    const postPayload: Record<string, unknown> = {
      title: article.title || article.topic,
      contentFormat: "markdown",
      content: article.article_markdown || "",
      publishStatus: status ?? "draft",
      tags: (tags ?? []).slice(0, 5), // Medium allows up to 5 tags
    };

    if (canonicalUrl) {
      postPayload.canonicalUrl = canonicalUrl;
    }

    const postRes = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(postPayload),
    });

    if (!postRes.ok) {
      const data = await postRes.json().catch(() => ({}));
      const errMsg =
        (data.errors?.[0]?.message) ||
        (data.error) ||
        `Medium error (${postRes.status})`;
      return NextResponse.json({ error: errMsg }, { status: postRes.status });
    }

    const result = await postRes.json();
    const post = result.data;

    await supabase
      .from("articles")
      .update({ posted: true, published_platform: "medium", updated_at: new Date().toISOString() })
      .eq("id", articleId)
      .eq("user_id", user.id);

    await logPublishEvent(supabase, {
      userId: user.id,
      articleId,
      platform: "medium",
      accountName: account.name,
      postId: post.id,
      postUrl: post.url,
      editUrl: post.url,
    });

    return NextResponse.json({ success: true, postId: post.id, postUrl: post.url, editUrl: post.url });
  } catch (error: unknown) {
    logger.error("Failed to publish to Medium", error);
    return NextResponse.json({ error: "Failed to publish to Medium" }, { status: 500 });
  }
}
