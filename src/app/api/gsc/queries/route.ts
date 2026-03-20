import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import { getAccessToken } from "@/lib/gsc-auth";

export interface GscQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Returns the top Search Console queries sorted by impressions (high impressions, low CTR =
 * content opportunities). These are pre-filled into the article generator.
 */
export async function GET() {
  try {
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
      return NextResponse.json({ error: "No GSC property selected. Choose one in Settings." }, { status: 400 });
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
      dimensions: ["query"],
      rowLimit: 25,
      // Sort by impressions descending — low CTR queries are content opportunities
      orderBy: [{ fieldName: "impressions", sortOrder: "DESCENDING" }],
    };

    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json({ error: err.error?.message || `GSC error (${res.status})` }, { status: res.status });
    }

    const data = await res.json() as {
      rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
    };

    const queries: GscQuery[] = (data.rows ?? []).map((r) => ({
      query: r.keys[0],
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: Math.round(r.ctr * 1000) / 10, // as percentage with 1 decimal
      position: Math.round(r.position * 10) / 10,
    }));

    return NextResponse.json({ queries, siteUrl });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
