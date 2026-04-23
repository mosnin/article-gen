import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { refreshGscAccessToken } from "@/lib/gsc/token";
import {
  runSearchAnalytics,
  GSC_ACCESS_DENIED_STATUSES,
  type GscAnalyticsRow,
} from "@/lib/gsc/query";

export const runtime = "nodejs";

type Body = { userId: string; limit?: number; days?: number };

type QueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
};

function isBody(v: unknown): v is Body {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.userId === "string" &&
    (r.limit === undefined || typeof r.limit === "number") &&
    (r.days === undefined || typeof r.days === "number")
  );
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  if (!isBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;
  const limit =
    typeof body.limit === "number" && body.limit > 0
      ? Math.min(Math.floor(body.limit), 25000)
      : 100;
  const days = typeof body.days === "number" && body.days > 0 ? body.days : 28;

  const sb = getAdminClient();
  const { data: settings } = await sb
    .from("user_settings")
    .select("gsc_refresh_token, gsc_site_url")
    .eq("user_id", body.userId)
    .maybeSingle();

  const encryptedToken =
    settings && typeof settings.gsc_refresh_token === "string"
      ? settings.gsc_refresh_token
      : null;
  const siteUrl =
    settings && typeof settings.gsc_site_url === "string"
      ? settings.gsc_site_url
      : null;

  if (!encryptedToken || !siteUrl) {
    return Response.json({ connected: false, queries: [] });
  }

  const accessToken = await refreshGscAccessToken(encryptedToken);
  if (!accessToken) {
    return Response.json({ connected: false, queries: [] });
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const result = await runSearchAnalytics(accessToken, siteUrl, {
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: ["query"],
    rowLimit: limit,
  });

  if (!result.ok) {
    if (GSC_ACCESS_DENIED_STATUSES.has(result.status)) {
      return Response.json({
        connected: true,
        queries: [],
        warning: "gsc-api-denied",
      });
    }
    return Response.json({ connected: false, queries: [] });
  }

  const rows: GscAnalyticsRow[] = result.data?.rows ?? [];
  const queries: QueryRow[] = rows.map((r) => ({
    query: r.keys[0] ?? "",
    clicks: Math.round(r.clicks),
    impressions: Math.round(r.impressions),
    position: Math.round(r.position * 10) / 10,
    ctr: Math.round(r.ctr * 1000) / 10,
  }));

  return Response.json({ connected: true, queries });
}
