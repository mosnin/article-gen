import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logPublishEvent } from "@/lib/publish-log";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

/**
 * Publishes an article to a Notion database as a new page.
 * Requires: Notion Integration Token + target Database ID.
 * The database must have: Name (title), Content (rich_text), Meta Description (rich_text),
 *   Slug (rich_text), Focus Keyword (rich_text), Status (select).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { articleId, databaseId: reqDatabaseId } = await req.json() as {
      articleId: string;
      databaseId?: string;
    };
    if (!articleId) return NextResponse.json({ error: "Article ID is required" }, { status: 400 });

    const { data: settings } = await supabase
      .from("user_settings")
      .select("notion_connections")
      .eq("user_id", user.id)
      .single();

    type NotionConnection = { id: string; name: string; databaseId: string; integrationToken: string };
    const connections = (settings?.notion_connections as NotionConnection[]) ?? [];
    const conn = reqDatabaseId
      ? connections.find((c) => c.id === reqDatabaseId)
      : connections[0];

    if (!conn?.integrationToken || !conn?.databaseId) {
      return NextResponse.json(
        { error: "No Notion connection configured. Add one in Settings → Integrations." },
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

    // Split markdown into 2000-char chunks for Notion's rich_text limit
    const markdown = article.article_markdown ?? "";
    const chunks = [];
    for (let i = 0; i < markdown.length; i += 1900) {
      chunks.push(markdown.slice(i, i + 1900));
    }

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.integrationToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: conn.databaseId },
        properties: {
          Name: {
            title: [{ text: { content: article.title ?? article.topic } }],
          },
          "Meta Description": {
            rich_text: [{ text: { content: (article.meta_description ?? "").slice(0, 2000) } }],
          },
          Slug: {
            rich_text: [{ text: { content: article.slug ?? "" } }],
          },
          "Focus Keyword": {
            rich_text: [{ text: { content: article.focus_keyword ?? "" } }],
          },
          Status: {
            select: { name: "Published" },
          },
        },
        children: [
          // Content as paragraph blocks
          ...chunks.map((chunk) => ({
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: chunk } }],
            },
          })),
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message ?? `Notion error (${res.status})` },
        { status: res.status }
      );
    }

    const result = await res.json();
    const pageId = result.id;
    const pageUrl = result.url;

    await supabase
      .from("articles")
      .update({ posted: true, published_platform: "notion", updated_at: new Date().toISOString() })
      .eq("id", articleId)
      .eq("user_id", user.id);

    await logPublishEvent(supabase, {
      userId: user.id,
      articleId,
      platform: "notion",
      accountName: conn.name,
      postId: pageId,
      postUrl: pageUrl,
    });

    return NextResponse.json({ success: true, pageId, pageUrl });
  } catch (error: unknown) {
    logger.error("Failed to publish to Notion", error);
    return NextResponse.json({ error: "Failed to publish to Notion" }, { status: 500 });
  }
}
