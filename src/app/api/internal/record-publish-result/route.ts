import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type RecordPublishResultBody = {
  userId: string;
  snippetId: string;
  success: boolean;
  externalUrl?: string;
  error?: string;
};

function isRecordPublishResultBody(v: unknown): v is RecordPublishResultBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.length === 0) return false;
  if (typeof r.snippetId !== "string" || r.snippetId.length === 0) return false;
  if (typeof r.success !== "boolean") return false;
  if (r.externalUrl !== undefined && typeof r.externalUrl !== "string") return false;
  if (r.error !== undefined && typeof r.error !== "string") return false;
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
  if (!isRecordPublishResultBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  const sb = getAdminClient();

  if (body.success) {
    const updates: Record<string, unknown> = {
      posted_at: new Date().toISOString(),
    };
    if (typeof body.externalUrl === "string" && body.externalUrl.length > 0) {
      updates.external_url = body.externalUrl;
    }

    const { error: updateErr } = await sb
      .from("social_snippets")
      .update(updates)
      .eq("id", body.snippetId)
      .eq("user_id", body.userId);

    if (updateErr) {
      return Response.json(
        { error: "update_failed", detail: updateErr.message },
        { status: 500 },
      );
    }
    return Response.json({ ok: true });
  }

  // Failure path: we don't have a per-snippet error column yet.
  // For v1 we just log; a future audit table can capture the trail.
  logger.warn("[social-publish] snippet publish failed", {
    userId: body.userId,
    snippetId: body.snippetId,
    error: body.error ?? "unknown",
    runId: auth.runId || null,
  });
  return Response.json({ ok: true });
}
