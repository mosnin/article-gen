import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { refreshGscAccessToken } from "@/lib/gsc/token";
import {
  runSearchAnalytics,
  GSC_ACCESS_DENIED_STATUSES,
  type GscAnalyticsRow,
} from "@/lib/gsc/query";

export const runtime = "nodejs";

type Body = { userId: string; articleId: string; days?: number };

type DisconnectedResponse = {
  connected: false;
  clicks: 0;
  impressions: 0;
  position: 0;
  ctr: 0;
  topQueries: [];
};

const DISCONNECTED: DisconnectedResponse = {
  connected: false,
  clicks: 0,
  impressions: 0,
  position: 0,
  ctr: 0,
  topQueries: [],
};

function isBody(v: unknown): v is Body {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.userId === "string" &&
    typeof r.articleId === "string" &&
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
  const days = typeof body.days === "number" && body.days > 0 ? body.days : 28;

  const sb = getAdminClient();

  const { data: article } = await sb
    .from("articles")
    .select("slug")
    .eq("id", body.articleId)
    .eq("user_id", body.userId)
    .maybeSingle();

  if (!article || typeof article.slug !== "string" || !article.slug) {
    return Response.json(DISCONNECTED);
  }

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
    return Response.json(DISCONNECTED);
  }

  const accessToken = await refreshGscAccessToken(encryptedToken);
  if (!accessToken) {
    return Response.json(DISCONNECTED);
  }

  const pageUrl = `${siteUrl.replace(/\/$/, "")}/${article.slug.replace(/^\//, "")}`;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const result = await runSearchAnalytics(accessToken, siteUrl, {
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: ["query"],
    dimensionFilterGroups: [
      {
        filters: [{ dimension: "page", operator: "equals", expression: pageUrl }],
      },
    ],
    rowLimit: 10,
  });

  if (!result.ok) {
    if (GSC_ACCESS_DENIED_STATUSES.has(result.status)) {
      return Response.json({
        connected: true,
        clicks: 0,
        impressions: 0,
        position: 0,
        ctr: 0,
        topQueries: [],
        warning: "gsc-api-denied",
      });
    }
    return Response.json(DISCONNECTED);
  }

  const rows: GscAnalyticsRow[] = result.data?.rows ?? [];

  let totalClicks = 0;
  let totalImpressions = 0;
  let weightedPosition = 0;

  const topQueries = rows.map((r) => {
    const clicks = Math.round(r.clicks);
    const impressions = Math.round(r.impressions);
    totalClicks += r.clicks;
    totalImpressions += r.impressions;
    weightedPosition += r.position * r.impressions;
    return {
      query: r.keys[0] ?? "",
      clicks,
      impressions,
      position: Math.round(r.position * 10) / 10,
    };
  });

  const position =
    totalImpressions > 0
      ? Math.round((weightedPosition / totalImpressions) * 10) / 10
      : 0;
  const ctr =
    totalImpressions > 0
      ? Math.round((totalClicks / totalImpressions) * 1000) / 10
      : 0;

  return Response.json({
    connected: true,
    clicks: Math.round(totalClicks),
    impressions: Math.round(totalImpressions),
    position,
    ctr,
    topQueries,
  });
}
