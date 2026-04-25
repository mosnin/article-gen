import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ListCompetitorsBody = {
  userId: string;
};

function isListCompetitorsBody(v: unknown): v is ListCompetitorsBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.userId === "string" && r.userId.trim() !== "";
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
  if (!isListCompetitorsBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("competitors")
    .select("id, domain, feed_url, sitemap_url, label, last_checked_at, active")
    .eq("user_id", body.userId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json(
      { error: "query_failed", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ competitors: data ?? [] });
}
