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
};

type ArticleRow = {
  id: string;
  title: string | null;
  slug: string | null;
  focus_keyword: string | null;
  keywords: string[] | null;
  topic: string | null;
};

type ArticleWithTraffic = {
  id: string;
  title: string;
  slug: string;
  focusKeyword: string;
  keywords: string[];
  topic: string;
  monthlyClicks: number | null;
};

function isBody(v: unknown): v is Body {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (r.limit !== undefined && typeof r.limit !== "number") return false;
  return true;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build the absolute page URL we hand to GSC's `page` dimension filter.
 * Mirrors the convention used by /api/internal/list-articles-with-gsc:
 *   `${siteUrl trimmed of trailing slash}/${slug trimmed of leading slash}`
 */
function pageUrlFor(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, "")}/${slug.replace(/^\//, "")}`;
}

function totalClicks(rows: GscAnalyticsRow[]): number {
  let n = 0;
  for (const r of rows) n += r.clicks;
  return Math.round(n);
}

async function fetchClicks(
  accessToken: string,
  siteUrl: string,
  pageUrl: string,
  startDate: string,
  endDate: string,
): Promise<number | null> {
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
      // appears in the response with a known-zero traffic number.
      return 0;
    }
    return null;
  }
  return totalClicks(result.data?.rows ?? []);
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

  const sb = getAdminClient();

  const { data: articleRows, error: articleErr } = await sb
    .from("articles")
    .select("id, title, slug, focus_keyword, keywords, topic")
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

  // Best-effort: if GSC isn't configured we still return the article
  // list with monthlyClicks=null so the agent can degrade gracefully.
  let accessToken: string | null = null;
  if (encryptedToken && siteUrl) {
    accessToken = await refreshGscAccessToken(encryptedToken);
  }
  const gscConnected = Boolean(accessToken && siteUrl);

  const articles: ArticleWithTraffic[] = [];

  if (!gscConnected) {
    for (const row of rows) {
      articles.push({
        id: row.id,
        title: row.title ?? "",
        slug: row.slug ?? "",
        focusKeyword: row.focus_keyword ?? "",
        keywords: row.keywords ?? [],
        topic: row.topic ?? "",
        monthlyClicks: null,
      });
    }
    return Response.json({ articles, gscConnected: false });
  }

  // Build the 30d window.
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const startStr = fmt(startDate);
  const endStr = fmt(endDate);

  // accessToken / siteUrl are guaranteed non-null here.
  const tokenStr = accessToken as string;
  const site = siteUrl as string;

  for (const row of rows) {
    let clicks: number | null = null;
    if (row.slug) {
      const pageUrl = pageUrlFor(site, row.slug);
      const fetched = await fetchClicks(tokenStr, site, pageUrl, startStr, endStr);
      clicks = fetched;
    }
    articles.push({
      id: row.id,
      title: row.title ?? "",
      slug: row.slug ?? "",
      focusKeyword: row.focus_keyword ?? "",
      keywords: row.keywords ?? [],
      topic: row.topic ?? "",
      monthlyClicks: clicks,
    });
  }

  return Response.json({ articles, gscConnected: true });
}
