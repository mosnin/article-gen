import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type GetBody = {
  articleId: string;
};

type ArticleRow = {
  id: string;
  title: string | null;
  article_markdown: string | null;
  focus_keyword: string | null;
  keywords: string[] | null;
  meta_description: string | null;
  slug: string | null;
  topic: string | null;
};

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: GetBody;
  try {
    body = JSON.parse(auth.rawBody) as GetBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.articleId) {
    return Response.json({ error: "articleId_required" }, { status: 400 });
  }

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("articles")
    .select(
      "id, title, article_markdown, focus_keyword, keywords, meta_description, slug, topic",
    )
    .eq("id", body.articleId)
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: "query_failed", detail: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const row = data as ArticleRow;
  return Response.json({
    articleId: row.id,
    title: row.title ?? "",
    articleMarkdown: row.article_markdown ?? "",
    focusKeyword: row.focus_keyword ?? "",
    keywords: row.keywords ?? [],
    metaDescription: row.meta_description ?? "",
    slug: row.slug ?? "",
    topic: row.topic ?? "",
  });
}
