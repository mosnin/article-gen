import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logPublishEvent } from "@/lib/publish-log";
import { marked } from "marked";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { articleId, siteId } = await req.json() as { articleId: string; siteId?: string };
    if (!articleId) return NextResponse.json({ error: "Article ID is required" }, { status: 400 });

    const { data: settings } = await supabase
      .from("user_settings")
      .select("webflow_sites")
      .eq("user_id", user.id)
      .single();

    type WebflowSite = { id: string; name: string; siteId: string; collectionId: string; apiToken: string };
    const sites = (settings?.webflow_sites as WebflowSite[]) ?? [];
    const site = siteId ? sites.find((s) => s.id === siteId) : sites[0];

    if (!site?.apiToken || !site?.collectionId) {
      return NextResponse.json(
        { error: "No Webflow site connected. Add one in Settings → Integrations." },
        { status: 400 }
      );
    }

    const { data: article } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    const html = await marked(article.article_markdown ?? "");

    // Webflow CMS Collections API v2
    const res = await fetch(
      `https://api.webflow.com/v2/collections/${site.collectionId}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${site.apiToken}`,
          "Content-Type": "application/json",
          "accept-version": "1.0.0",
        },
        body: JSON.stringify({
          isArchived: false,
          isDraft: false,
          fieldData: {
            name: article.title ?? article.topic,
            slug: article.slug ?? article.topic.toLowerCase().replace(/\s+/g, "-"),
            "post-body": html,
            "post-summary": article.meta_description ?? "",
            "meta-title": article.title ?? article.topic,
            "meta-description": article.meta_description ?? "",
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message ?? `Webflow error (${res.status})` },
        { status: res.status }
      );
    }

    const result = await res.json();
    const itemId = result.id ?? result._id;
    const postUrl = `https://${site.name}.webflow.io/${article.slug ?? ""}`;

    await supabase
      .from("articles")
      .update({ posted: true, published_platform: "webflow", updated_at: new Date().toISOString() })
      .eq("id", articleId);

    await logPublishEvent(supabase, {
      userId: user.id,
      articleId,
      platform: "webflow",
      accountName: site.name,
      postId: itemId,
      postUrl,
    });

    return NextResponse.json({ success: true, itemId, postUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
