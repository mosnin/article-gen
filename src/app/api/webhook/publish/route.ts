import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logPublishEvent } from "@/lib/publish-log";
import { marked } from "marked";
import { safeFetch, validatePublicUrl } from "@/lib/ssrf";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, webhookId } = await req.json() as {
      articleId: string;
      webhookId?: string;
    };

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    // Load user settings to get webhook endpoints
    const { data: settings } = await supabase
      .from("user_settings")
      .select("webhook_endpoints")
      .eq("user_id", user.id)
      .single();

    type WebhookEndpoint = { id: string; name: string; url: string; secret?: string; format: "json" | "html" | "markdown" };
    const webhooks = (settings?.webhook_endpoints as WebhookEndpoint[]) ?? [];
    const webhook = webhookId ? webhooks.find((w) => w.id === webhookId) : webhooks[0];

    if (!webhook?.url) {
      return NextResponse.json(
        { error: "No webhook configured. Add one in Settings → Integrations." },
        { status: 400 }
      );
    }

    // Validate webhook URL to prevent SSRF
    try {
      validatePublicUrl(webhook.url);
    } catch (e) {
      return NextResponse.json(
        { error: `Invalid webhook URL: ${(e as Error).message}` },
        { status: 400 }
      );
    }

    // Load article
    const { data: article } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Build payload based on format preference
    let content: string = article.article_markdown ?? "";
    if (webhook.format === "html") {
      content = await marked(article.article_markdown ?? "");
    }

    const payload = {
      event: "article.published",
      timestamp: new Date().toISOString(),
      article: {
        id: article.id,
        title: article.title ?? article.topic,
        slug: article.slug ?? "",
        topic: article.topic,
        focusKeyword: article.focus_keyword ?? "",
        keywords: article.keywords ?? [],
        metaDescription: article.meta_description ?? "",
        content,
        schema: article.schema_json ?? "",
        imagePrompts: article.image_prompts ?? [],
        images: (article.generated_images ?? []).filter((i: { success: boolean }) => i.success),
        quality: article.quality ?? "standard",
        createdAt: article.created_at,
      },
    };

    // Add HMAC signature if secret provided
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-ArticleGen-Event": "article.published",
      "X-ArticleGen-Article-Id": articleId,
    };

    if (webhook.secret) {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(webhook.secret);
      const msgData = encoder.encode(JSON.stringify(payload));
      const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, msgData);
      const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
      headers["X-ArticleGen-Signature"] = `sha256=${hex}`;
    }

    // Send webhook (safeFetch validates URL and enforces timeout)
    const res = await safeFetch(webhook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      timeoutMs: 15_000,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Webhook returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    // Mark article as posted
    await supabase
      .from("articles")
      .update({ posted: true, published_platform: "webhook", updated_at: new Date().toISOString() })
      .eq("id", articleId);

    await logPublishEvent(supabase, {
      userId: user.id,
      articleId,
      platform: "webhook",
      accountName: webhook.name || webhook.url,
      postId: articleId,
      postUrl: webhook.url,
    });

    return NextResponse.json({ success: true, webhookUrl: webhook.url, statusCode: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
