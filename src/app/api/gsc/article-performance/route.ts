import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import { getAccessToken } from "@/lib/gsc-auth";
import { logger } from "@/lib/logger";

interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface ArticlePerformance {
  articleId: string;
  title: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  platform: string;
}

/**
 * Returns published article performance data by cross-referencing
 * Google Search Console page-level analytics with publish_logs.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch GSC credentials
    const { data: settings } = await supabase
      .from("user_settings")
      .select("gsc_refresh_token, gsc_site_url")
      .eq("user_id", user.id)
      .single();

    if (!settings?.gsc_refresh_token) {
      return NextResponse.json({ error: "Google Search Console not connected" }, { status: 400 });
    }
    if (!settings?.gsc_site_url) {
      return NextResponse.json(
        { error: "No GSC property selected. Choose one in Settings." },
        { status: 400 },
      );
    }

    const refreshToken = decryptCredential(settings.gsc_refresh_token as string);
    const accessToken = await getAccessToken(refreshToken);
    const siteUrl = settings.gsc_site_url as string;

    // Last 28 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const body = {
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      dimensions: ["page"],
      rowLimit: 500,
      orderBy: [{ fieldName: "impressions", sortOrder: "DESCENDING" }],
    };

    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      logger.error("GSC Search Analytics request failed", new Error(err.error?.message ?? `Status ${res.status}`), {
        userId: user.id,
        endpoint: "/api/gsc/article-performance",
      });
      return NextResponse.json({ error: "Failed to fetch performance data" }, { status: res.status });
    }

    const data = (await res.json()) as { rows?: GscRow[] };
    const gscRows = data.rows ?? [];

    // Build a map of page URL -> metrics
    const pageMetrics = new Map<string, { clicks: number; impressions: number; ctr: number; position: number }>();
    for (const row of gscRows) {
      const pageUrl = row.keys[0];
      pageMetrics.set(pageUrl, {
        clicks: Math.round(row.clicks),
        impressions: Math.round(row.impressions),
        ctr: Math.round(row.ctr * 1000) / 10,
        position: Math.round(row.position * 10) / 10,
      });
    }

    // Fetch publish logs with article titles
    const { data: publishLogs, error: logsError } = await supabase
      .from("publish_logs")
      .select("article_id, post_url, platform, articles(title)")
      .eq("user_id", user.id)
      .order("published_at", { ascending: false });

    if (logsError) {
      logger.error("Failed to query publish_logs", new Error(logsError.message), {
        userId: user.id,
        endpoint: "/api/gsc/article-performance",
      });
      return NextResponse.json({ error: "Failed to fetch article data" }, { status: 500 });
    }

    // Cross-reference publish logs with GSC data
    const articles: ArticlePerformance[] = [];
    const seenArticles = new Set<string>();

    for (const log of publishLogs ?? []) {
      const postUrl = log.post_url as string | null;
      if (!postUrl) continue;

      // Deduplicate by article_id + URL
      const dedupeKey = `${log.article_id}:${postUrl}`;
      if (seenArticles.has(dedupeKey)) continue;
      seenArticles.add(dedupeKey);

      // Try to match the URL in GSC data (exact match or trailing-slash variant)
      const metrics =
        pageMetrics.get(postUrl) ??
        pageMetrics.get(postUrl.endsWith("/") ? postUrl.slice(0, -1) : postUrl + "/");

      if (!metrics) continue;

      const articleData = log.articles as { title: string } | null;
      articles.push({
        articleId: log.article_id as string,
        title: articleData?.title ?? "Untitled",
        url: postUrl,
        clicks: metrics.clicks,
        impressions: metrics.impressions,
        ctr: metrics.ctr,
        position: metrics.position,
        platform: log.platform as string,
      });
    }

    // Sort by impressions descending
    articles.sort((a, b) => b.impressions - a.impressions);

    return NextResponse.json({ articles });
  } catch (err) {
    logger.error("Unexpected error in article-performance", err, {
      endpoint: "/api/gsc/article-performance",
    });
    return NextResponse.json({ error: "Failed to fetch article performance" }, { status: 500 });
  }
}
