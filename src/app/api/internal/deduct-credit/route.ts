import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { deductCredit } from "@/lib/credits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { userId: string; articleId?: string; description?: string };
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
    // deductCredit signature in src/lib/credits.ts:
    //   (supabase, userId, articleId?, description?) -> { success, credits }
    const result = await deductCredit(
      sb,
      body.userId,
      body.articleId,
      body.description || "agent run"
    );
    if (!result.success) {
      return Response.json(
        { error: "insufficient_credits", credits: result.credits },
        { status: 402 }
      );
    }
    return Response.json({ success: true, credits: result.credits });
  } catch (e) {
    return Response.json(
      { error: "deduct_failed", detail: String(e) },
      { status: 500 }
    );
  }
}
