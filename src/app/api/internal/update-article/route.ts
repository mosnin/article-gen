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
]);

type UpdateBody = {
  articleId: string;
  patch: Record<string, unknown>;
};

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: UpdateBody;
  try {
    body = JSON.parse(auth.rawBody) as UpdateBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.articleId || !body.patch || typeof body.patch !== "object") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.patch)) {
    if (ALLOWED_COLUMNS.has(k)) clean[k] = v;
  }
  if (Object.keys(clean).length === 0) {
    return Response.json({ error: "no_valid_columns" }, { status: 400 });
  }
  clean.updated_at = new Date().toISOString();

  const sb = getAdminClient();
  const { error } = await sb.from("articles").update(clean).eq("id", body.articleId);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });
  return Response.json({ ok: true });
}
