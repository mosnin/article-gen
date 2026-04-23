import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type SaveAuditBody = {
  userId: string;
  runId: string;
  articleId: string;
  gscSnapshot?: unknown;
  recommendations?: unknown;
  overallScore?: number;
  decidedAction?: string;
};

function isSaveAuditBody(v: unknown): v is SaveAuditBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.userId === "string" &&
    typeof r.runId === "string" &&
    typeof r.articleId === "string"
  );
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
  if (!isSaveAuditBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("article_audits")
    .insert({
      user_id: body.userId,
      run_id: body.runId,
      article_id: body.articleId,
      gsc_snapshot: body.gscSnapshot ?? null,
      recommendations: body.recommendations ?? null,
      overall_score: typeof body.overallScore === "number" ? body.overallScore : null,
      decided_action: body.decidedAction ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return Response.json(
      { error: "insert_failed", detail: error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  return Response.json({ auditId: data.id });
}
