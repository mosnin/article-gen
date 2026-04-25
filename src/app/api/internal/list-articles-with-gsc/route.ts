import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { refreshGscAccessToken } from "@/lib/gsc/token";
import {
  runSearchAnalytics,
  GSC_ACCESS_DENIED_STATUSES,
  type GscAnalyticsRow,
} from "@/lib/gsc/query";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  userId: string;
  limit?: number;
  periodDays?: number;
};

type ArticleRow = {
  id: string;
  title: string | null;
  slug: string | null;
  focus_keyword: string | null;
};

type WindowMetrics = {
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
};

type ArticlePerformance = {
  id: string;
  title: string;
  slug: string;
  focusKeyword: string;
  current: WindowMetrics;
  baseline: WindowMetrics;
  changePct: WindowMetrics;
};

const ZERO_METRICS: WindowMetrics = { clicks: 0, impressions: 0, position: 0, ctr: 0 };

function isBody(v: unknown): v is Body {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (r.limit !== undefined && typeof r.limit !== "number") return false;
  if (r.periodDays !== undefined && typeof r.periodDays !== "number") return false;
  return true;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build the absolute page URL we hand to GSC's `page` dimension filter.
 * Mirrors the convention used by /api/internal/gsc-article-performance:
 *   `${siteUrl trimmed of trailing slash}/${slug trimmed of leading slash}`
 *
 * The article's public URL on the user's published site is the
 * concatenation of their configured GSC site URL (e.g. https://example.com)
 * and the slug stored on the articles row. We do not assume any /blog/
 * prefix because each user's CMS may host posts at a different root.
 */
function pageUrlFor(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, "")}/${slug.replace(/^\//, "")}`;
}

function aggregate(rows: GscAnalyticsRow[]): WindowMetrics {
  let totalClicks = 0;
  let totalImpressions = 0;
  let weightedPosition = 0;
  for (const r of rows) {
    totalClicks += r.clicks;
    totalImpressions += r.impressions;
    weightedPosition += r.position * r.impressions;
  }
  const position =
    totalImpressions > 0
      ? Math.round((weightedPosition / totalImpressions) * 10) / 10
      : 0;
  const ctr =
    totalImpressions > 0
      ? Math.round((totalClicks / totalImpressions) * 1000) / 10
      : 0;
  return {
    clicks: Math.round(totalClicks),
    impressions: Math.round(totalImpressions),
    position,
    ctr,
  };
}

function pctChange(current: number, baseline: number): number {
  if (baseline === 0) {
    if (current === 0) return 0;
    return current > 0 ? 100 : -100;
  }
  return Math.round(((current - baseline) / baseline) * 1000) / 10;
}

function diffMetrics(current: WindowMetrics, baseline: WindowMetrics): WindowMetrics {
  return {
    clicks: pctChange(current.clicks, baseline.clicks),
    impressions: pctChange(current.impressions, baseline.impressions),
    position: pctChange(current.position, baseline.position),
    ctr: pctChange(current.ctr, baseline.ctr),
  };
}

async function fetchWindow(
  accessToken: string,
  siteUrl: string,
  pageUrl: string,
  startDate: string,
  endDate: string,
): Promise<WindowMetrics | null> {
  const result = await runSearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["page"],
    dimensionFilterGroups: [
      {
        filters: [
          { dimension: "page", operator: "equals", expression: pageUrl },
        ],
      },
    ],
    rowLimit: 1,
  });
  if (!result.ok) {
    if (GSC_ACCESS_DENIED_STATUSES.has(result.status)) {
      // Access denied for this URL — treat as zero so the article still
      // appears in the response with empty metrics.
      return ZERO_METRICS;
    }
    return null;
  }
  return aggregate(result.data?.rows ?? []);
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
      ? Math.min(Math.floor(body.limit), 200)
      : 100;
  const periodDays =
    typeof body.periodDays === "number" && body.periodDays > 0
      ? Math.floor(body.periodDays)
      : 30;

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
    return Response.json({ articles: [], gscConnected: false });
  }

  const accessToken = await refreshGscAccessToken(encryptedToken);
  if (!accessToken) {
    return Response.json({ articles: [], gscConnected: false });
  }

  const { data: articleRows, error: articleErr } = await sb
    .from("articles")
    .select("id, title, slug, focus_keyword")
    .eq("user_id", body.userId)
    .eq("lifecycle", "published")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (articleErr) {
    return Response.json(
      { error: "query_failed", detail: articleErr.message },
      { status: 500 },
    );
  }

  const rows = (articleRows ?? []) as ArticleRow[];
  const articles: ArticlePerformance[] = [];

  // Build the two date windows. `current` is the most recent N days,
  // `baseline` is the N days immediately before that.
  const currentEnd = new Date();
  const currentStart = new Date();
  currentStart.setDate(currentStart.getDate() - periodDays);
  const baselineEnd = new Date(currentStart);
  const baselineStart = new Date(currentStart);
  baselineStart.setDate(baselineStart.getDate() - periodDays);

  const currentStartStr = fmt(currentStart);
  const currentEndStr = fmt(currentEnd);
  const baselineStartStr = fmt(baselineStart);
  const baselineEndStr = fmt(baselineEnd);

  for (const row of rows) {
    if (!row.slug) continue;
    const pageUrl = pageUrlFor(siteUrl, row.slug);

    const current = await fetchWindow(
      accessToken,
      siteUrl,
      pageUrl,
      currentStartStr,
      currentEndStr,
    );
    const baseline = await fetchWindow(
      accessToken,
      siteUrl,
      pageUrl,
      baselineStartStr,
      baselineEndStr,
    );

    if (current === null || baseline === null) {
      // Hard failure on this URL — skip rather than fabricate.
      continue;
    }

    articles.push({
      id: row.id,
      title: row.title ?? "",
      slug: row.slug,
      focusKeyword: row.focus_keyword ?? "",
      current,
      baseline,
      changePct: diffMetrics(current, baseline),
    });
  }

  return Response.json({ articles, gscConnected: true });
}
