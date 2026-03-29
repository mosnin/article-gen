import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import { getAccessToken } from "@/lib/gsc-auth";

export const maxDuration = 30;

export interface KeywordRanking {
  query: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
  trend: "up" | "down" | "stable";
  opportunity: "snippet" | "top3" | "page1" | "growing" | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("gsc_refresh_token, gsc_site_url")
    .eq("user_id", user.id)
    .single();

  if (!settings?.gsc_refresh_token) {
    return NextResponse.json({ error: "Google Search Console not connected" }, { status: 400 });
  }
  if (!settings?.gsc_site_url) {
    return NextResponse.json({ error: "No GSC property selected" }, { status: 400 });
  }

  const refreshToken = decryptCredential(settings.gsc_refresh_token as string);
  const accessToken = await getAccessToken(refreshToken);
  const siteUrl = settings.gsc_site_url as string;

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const endDate = fmt(today);

  // Current period: last 28 days
  const startCurrent = new Date(today);
  startCurrent.setDate(startCurrent.getDate() - 28);

  // Previous period: 28-56 days ago
  const startPrev = new Date(today);
  startPrev.setDate(startPrev.getDate() - 56);
  const endPrev = new Date(today);
  endPrev.setDate(endPrev.getDate() - 29);

  const fetchPeriod = async (start: string, end: string) => {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          dimensions: ["query"],
          rowLimit: 100,
          startRow: 0,
        }),
      }
    );
    const data = await res.json();
    return data.rows ?? [];
  };

  const [currentRows, prevRows] = await Promise.all([
    fetchPeriod(fmt(startCurrent), endDate),
    fetchPeriod(fmt(startPrev), fmt(endPrev)),
  ]);

  type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };
  const prevMap = new Map<string, number>();
  for (const r of prevRows as GscRow[]) {
    prevMap.set(r.keys[0], r.position);
  }

  const rankings: KeywordRanking[] = (currentRows as GscRow[]).map((r) => {
    const query = r.keys[0];
    const prevPos = prevMap.get(query);
    let trend: KeywordRanking["trend"] = "stable";
    if (prevPos !== undefined) {
      if (r.position < prevPos - 1) trend = "up";
      else if (r.position > prevPos + 1) trend = "down";
    }

    let opportunity: KeywordRanking["opportunity"] = null;
    if (r.position <= 3 && r.position > 1) opportunity = "top3";
    else if (r.position <= 10 && r.position > 3) opportunity = "snippet";
    else if (r.position > 10 && r.position <= 20) opportunity = "page1";
    else if (trend === "up" && r.impressions > 50) opportunity = "growing";

    return {
      query,
      position: Math.round(r.position * 10) / 10,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Math.round(r.ctr * 1000) / 10,
      trend,
      opportunity,
    };
  });

  // Sort by impressions desc
  rankings.sort((a, b) => b.impressions - a.impressions);

  return NextResponse.json({ rankings, siteUrl });
}
