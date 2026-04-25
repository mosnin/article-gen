import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ALLOWED_COLUMNS = new Set([
  "title",
  "meta_description",
  "slug",
  "keywords",
  "article_markdown",
  "image_prompts",
  "generated_images",
  "schema_json",
  "posted",
  "published_platform",
  "wp_blog_id",
  "cluster_id",
  "last_refreshed_at",
  "lifecycle",
  "parent_article_id",
]);

type UpdateBody = {
  articleId: string;
  userId: string;
  patch: Record<string, unknown>;
};

function isUpdateBody(v: unknown): v is UpdateBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.articleId !== "string" || r.articleId.trim() === "") return false;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (!r.patch || typeof r.patch !== "object" || Array.isArray(r.patch)) return false;
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

  if (!isUpdateBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.patch)) {
    if (ALLOWED_COLUMNS.has(k)) clean[k] = v;
  }
  if (Object.keys(clean).length === 0) {
    return Response.json({ error: "no_valid_columns" }, { status: 400 });
  }
  clean.updated_at = new Date().toISOString();

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("articles")
    .update(clean)
    .eq("id", body.articleId)
    .eq("user_id", body.userId)
    .select("id");
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });
  if (!data || data.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
