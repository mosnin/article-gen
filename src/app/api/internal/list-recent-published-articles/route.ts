import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ListBody = {
  userId: string;
  periodDays: number;
};

type ArticleRow = {
  id: string;
  title: string | null;
  slug: string | null;
  focus_keyword: string | null;
  meta_description: string | null;
  published_at: string | null;
  article_markdown: string | null;
};

function isListBody(v: unknown): v is ListBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (
    typeof r.periodDays !== "number" ||
    !Number.isFinite(r.periodDays) ||
    r.periodDays <= 0
  ) {
    return false;
  }
  return true;
}

function clampPeriodDays(n: number): number {
  const v = Math.round(n);
  return Math.max(1, Math.min(365, v));
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

  const periodDays = clampPeriodDays(parsed.periodDays);
  const cutoffMs = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("articles")
    .select(
      "id, title, slug, focus_keyword, meta_description, published_at, article_markdown",
    )
    .eq("user_id", parsed.userId)
    .eq("lifecycle", "published")
    .gte("published_at", cutoffIso)
    .order("published_at", { ascending: false })
    .limit(30);

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
      metaDescription: a.meta_description ?? "",
      publishedAt: a.published_at ?? null,
      excerpt: (a.article_markdown ?? "").slice(0, 240),
    })),
  });
}
