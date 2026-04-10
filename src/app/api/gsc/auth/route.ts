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

  const { origin, searchParams } = new URL(req.url);
  const redirectUri = `${origin}/api/gsc/callback`;

  // Optional returnTo so callers get redirected back to the right page after OAuth
  const returnTo = searchParams.get("returnTo") ?? "/app/settings";

  // Generate a cryptographically random state to prevent CSRF
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600, // 10 minutes
  };
  response.cookies.set("gsc_oauth_state", state, cookieOpts);
  response.cookies.set("gsc_return_to", returnTo, cookieOpts);

  return response;
}
