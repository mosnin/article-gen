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

interface ContentGap {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  matchedArticle?: { id: string; title: string; url: string };
  type: "optimize" | "create";
}

/**
 * Identifies content gap opportunities by cross-referencing GSC high-impression/low-CTR
 * queries with published articles. Returns "optimize" gaps (article exists but underperforms)
 * and "create" gaps (no article covers the query).
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

    // Last 90 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const body = {
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      dimensions: ["query", "page"],
      rowLimit: 1000,
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
        endpoint: "/api/gsc/content-gaps",
      });
      return NextResponse.json({ error: "Failed to fetch search data" }, { status: res.status });
    }

    const data = (await res.json()) as { rows?: GscRow[] };
    const gscRows = data.rows ?? [];

    // Filter for "gap" queries: high impressions, low CTR, rankable position
    const gapRows = gscRows.filter(
      (row) =>
        row.impressions > 50 &&
        row.ctr < 0.05 &&
        row.position > 3 &&
        row.position < 30,
    );

    // Fetch publish logs to cross-reference page URLs with articles
    const { data: publishLogs, error: logsError } = await supabase
      .from("publish_logs")
      .select("article_id, post_url, articles(title)")
      .eq("user_id", user.id)
      .order("published_at", { ascending: false });

    if (logsError) {
      logger.error("Failed to query publish_logs", new Error(logsError.message), {
        userId: user.id,
        endpoint: "/api/gsc/content-gaps",
      });
      return NextResponse.json({ error: "Failed to fetch article data" }, { status: 500 });
    }

    // Build a map of published page URLs to article info
    const urlToArticle = new Map<string, { id: string; title: string; url: string }>();
    for (const log of publishLogs ?? []) {
      const postUrl = log.post_url as string | null;
      if (!postUrl || !log.article_id) continue;

      const articleData = log.articles as unknown as { title: string } | null;
      const entry = {
        id: log.article_id as string,
        title: articleData?.title ?? "Untitled",
        url: postUrl,
      };

      // Store both with and without trailing slash for flexible matching
      urlToArticle.set(postUrl, entry);
      if (postUrl.endsWith("/")) {
        urlToArticle.set(postUrl.slice(0, -1), entry);
      } else {
        urlToArticle.set(postUrl + "/", entry);
      }
    }

    // Build content gaps list
    const gaps: ContentGap[] = [];
    const seenQueries = new Set<string>();

    for (const row of gapRows) {
      const query = row.keys[0];
      const pageUrl = row.keys[1];

      // Deduplicate by query (keep highest-impression variant)
      if (seenQueries.has(query)) continue;
      seenQueries.add(query);

      const matchedArticle = urlToArticle.get(pageUrl);

      gaps.push({
        query,
        impressions: Math.round(row.impressions),
        clicks: Math.round(row.clicks),
        ctr: Math.round(row.ctr * 1000) / 10,
        position: Math.round(row.position * 10) / 10,
        matchedArticle: matchedArticle
          ? { id: matchedArticle.id, title: matchedArticle.title, url: matchedArticle.url }
          : undefined,
        type: matchedArticle ? "optimize" : "create",
      });
    }

    // Sort by impressions descending (highest opportunity first)
    gaps.sort((a, b) => b.impressions - a.impressions);

    logger.info("Content gaps fetched", {
      userId: user.id,
      action: "content-gaps",
    });

    return NextResponse.json({ gaps });
  } catch (err) {
    logger.error("Unexpected error in content-gaps", err, {
      endpoint: "/api/gsc/content-gaps",
    });
    return NextResponse.json({ error: "Failed to analyze content gaps" }, { status: 500 });
  }
}
