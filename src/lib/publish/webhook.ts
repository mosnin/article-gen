/**
 * Custom-webhook article delivery, shared by /api/webhook/publish and the
 * MCP publish tools. Endpoints come from user_settings.webhook_endpoints;
 * URLs are SSRF-validated and payloads are HMAC-SHA256 signed when the
 * endpoint has a secret configured.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { marked } from "marked";
import { safeFetch, validatePublicUrl } from "@/lib/ssrf";
import { logPublishEvent } from "@/lib/publish-log";

export type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  secret?: string;
  format: "json" | "html" | "markdown";
};

export type WebhookDeliveryResult = {
  success: boolean;
  webhookUrl?: string;
  statusCode?: number;
  error?: string;
};

/** Deliver an article to one of the user's configured webhook endpoints.
 *  The supabase client must already be scoped (or the queries filtered) to
 *  the owning user — this function filters by userId on every query. */
export async function deliverArticleWebhook(params: {
  supabase: SupabaseClient;
  userId: string;
  articleId: string;
  webhookId?: string;
}): Promise<WebhookDeliveryResult> {
  const { supabase, userId, articleId, webhookId } = params;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("webhook_endpoints")
    .eq("user_id", userId)
    .single();

  const webhooks = (settings?.webhook_endpoints as WebhookEndpoint[]) ?? [];
  const webhook = webhookId ? webhooks.find((w) => w.id === webhookId) : webhooks[0];

  if (!webhook?.url) {
    return { success: false, error: "No webhook configured. Add one in Settings → Integrations." };
  }

  try {
    validatePublicUrl(webhook.url);
  } catch (e) {
    return { success: false, error: `Invalid webhook URL: ${(e as Error).message}` };
  }

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .eq("user_id", userId)
    .single();

  if (!article) {
    return { success: false, error: "Article not found" };
  }

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

  const res = await safeFetch(webhook.url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    timeoutMs: 15_000,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { success: false, error: `Webhook returned ${res.status}: ${text.slice(0, 200)}` };
  }

  await supabase
    .from("articles")
    .update({ posted: true, published_platform: "webhook", updated_at: new Date().toISOString() })
    .eq("id", articleId)
    .eq("user_id", userId);

  await logPublishEvent(supabase, {
    userId,
    articleId,
    platform: "webhook",
    accountName: webhook.name || webhook.url,
    postId: articleId,
    postUrl: webhook.url,
  });

  return { success: true, webhookUrl: webhook.url, statusCode: res.status };
}
