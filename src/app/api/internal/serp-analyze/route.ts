import { requireInternalAuth } from "@/lib/agent-auth";
import { analyzeSERP } from "@/lib/serp-analyzer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { keyword: string; numResults?: number };
  try {
    body = JSON.parse(auth.rawBody) as { keyword: string; numResults?: number };
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.keyword) {
    return Response.json({ error: "keyword_required" }, { status: 400 });
  }

  try {
    const result = await analyzeSERP(body.keyword, body.numResults ?? 10);
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: "serp_failed", detail: String(e) },
      { status: 502 },
    );
  }
}
