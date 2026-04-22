import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { checkCredits, getOrCreateProfile } from "@/lib/credits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { userId: string; amount?: number };
  try {
    body = JSON.parse(auth.rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.userId) {
    return Response.json({ error: "userId_required" }, { status: 400 });
  }

  const sb = getAdminClient();
  try {
    const profile = await getOrCreateProfile(sb, body.userId);
    const result = await checkCredits(sb, body.userId, body.amount ?? 1);
    // `checkCredits` returns { allowed, credits, isAdmin }. Surface a simple
    // { ok, credits } shape to callers, preserving admin unlimited (-1).
    return Response.json({
      ok: result.allowed,
      credits: result.isAdmin ? -1 : profile?.credits ?? 0,
      isAdmin: result.isAdmin,
    });
  } catch (e) {
    return Response.json(
      { error: "check_failed", detail: String(e) },
      { status: 500 }
    );
  }
}
