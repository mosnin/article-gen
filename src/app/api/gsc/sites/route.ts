import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import { getAccessToken } from "@/lib/gsc-auth";

// Valid GSC site URL prefixes (sc-domain:, sc-https:, http://, https://)
const VALID_SITE_URL = /^(sc-domain:|sc-https:|https?:\/\/)/;

/** Returns the list of GSC properties the user has access to. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: settings } = await supabase
      .from("user_settings").select("gsc_refresh_token").eq("user_id", user.id).single();

    if (!settings?.gsc_refresh_token) {
      return NextResponse.json({ error: "Google Search Console not connected" }, { status: 400 });
    }

    const refreshToken = decryptCredential(settings.gsc_refresh_token as string);
    const accessToken = await getAccessToken(refreshToken);

    const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `GSC API error (${res.status})` }, { status: res.status });
    }

    const data = await res.json() as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> };
    return NextResponse.json({ sites: data.siteEntry ?? [] });
  } catch {
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
  }
}

/** Save the selected GSC site URL — validates that the user actually has GSC access to it. */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { siteUrl } = await req.json() as { siteUrl: unknown };

    if (!siteUrl || typeof siteUrl !== "string") {
      return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
    }

    // Validate format before making any API calls
    if (!VALID_SITE_URL.test(siteUrl)) {
      return NextResponse.json({ error: "Invalid site URL format" }, { status: 400 });
    }

    // Verify the user actually has access to this site in their GSC account
    const { data: settings } = await supabase
      .from("user_settings")
      .select("gsc_refresh_token")
      .eq("user_id", user.id)
      .single();

    if (!settings?.gsc_refresh_token) {
      return NextResponse.json({ error: "Google Search Console not connected" }, { status: 400 });
    }

    const refreshToken = decryptCredential(settings.gsc_refresh_token as string);
    const accessToken = await getAccessToken(refreshToken);

    const sitesRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!sitesRes.ok) {
      return NextResponse.json({ error: "Failed to verify site access" }, { status: 502 });
    }

    const sitesData = await sitesRes.json() as { siteEntry?: Array<{ siteUrl: string }> };
    const authorizedSites = (sitesData.siteEntry ?? []).map((s) => s.siteUrl);

    if (!authorizedSites.includes(siteUrl)) {
      return NextResponse.json({ error: "You do not have access to this site in Google Search Console" }, { status: 403 });
    }

    await supabase
      .from("user_settings")
      .update({ gsc_site_url: siteUrl, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save site" }, { status: 500 });
  }
}
