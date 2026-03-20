import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import { getAccessToken } from "@/lib/gsc-auth";

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
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** Save the selected GSC site URL. */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { siteUrl } = await req.json() as { siteUrl: string };
    if (!siteUrl) return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });

    await supabase.from("user_settings")
      .update({ gsc_site_url: siteUrl, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
