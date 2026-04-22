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
  meta_description: string | null;
  created_at: string | null;
};

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: ListBody;
  try {
    body = JSON.parse(auth.rawBody) as ListBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.userId) return Response.json({ error: "userId_required" }, { status: 400 });
  const limit = Math.min(100, Math.max(1, body.limit ?? 20));

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("articles")
    .select("id, title, slug, meta_description, created_at")
    .eq("user_id", body.userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return Response.json({ error: "query_failed" }, { status: 500 });

  const rows = (data ?? []) as ArticleRow[];
  return Response.json({
    articles: rows.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.meta_description ?? "",
      createdAt: a.created_at,
    })),
  });
}
