import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ListBody = {
  userId: string;
  limit?: number;
};

type ArticleRow = {
  id: string;
  title: string | null;
  slug: string | null;
  focus_keyword: string | null;
  keywords: string[] | null;
  article_markdown: string | null;
};

function isListBody(v: unknown): v is ListBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (r.limit !== undefined && typeof r.limit !== "number") return false;
  return true;
}

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(auth.rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isListBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const limit = Math.min(200, Math.max(1, parsed.limit ?? 200));
  const sb = getAdminClient();
  const { data, error } = await sb
    .from("articles")
    .select("id, title, slug, focus_keyword, keywords, article_markdown")
    .eq("user_id", parsed.userId)
    .eq("lifecycle", "published")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json(
      { error: "query_failed", detail: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as ArticleRow[];
  return Response.json({
    articles: rows.map((a) => ({
      id: a.id,
      title: a.title ?? "",
      slug: a.slug ?? "",
      focusKeyword: a.focus_keyword ?? "",
      keywords: a.keywords ?? [],
      excerpt: (a.article_markdown ?? "").slice(0, 240),
    })),
  });
}
