import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/** Redirects the user to Google's OAuth consent screen for Search Console read access. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth is not configured (GOOGLE_CLIENT_ID missing)" }, { status: 500 });
  }

  const { origin } = new URL(req.url);
  const redirectUri = `${origin}/api/gsc/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    access_type: "offline",
    prompt: "consent",
    state: user.id, // passed back in callback for verification
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
