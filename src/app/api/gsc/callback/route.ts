import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { encryptCredential } from "@/lib/wp-crypto";

/** Handles the OAuth callback from Google, exchanges the code for tokens, and stores them. */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const stateParam = searchParams.get("state");

  // Read returnTo cookie (set by /api/gsc/auth) — default to /app/settings
  const returnTo = req.cookies.get("gsc_return_to")?.value ?? "/app/settings";
  const baseReturn = `${origin}${returnTo}`;

  // Validate CSRF state
  const storedState = req.cookies.get("gsc_oauth_state")?.value;
  if (!storedState || !stateParam || storedState !== stateParam) {
    return NextResponse.redirect(`${baseReturn}?gsc_error=invalid_state`);
  }

  if (error || !code) {
    return NextResponse.redirect(`${baseReturn}?gsc_error=${error || "no_code"}`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseReturn}?gsc_error=not_configured`);
  }

  const redirectUri = `${origin}/api/gsc/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseReturn}?gsc_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json() as { refresh_token?: string; access_token?: string };
  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${baseReturn}?gsc_error=no_refresh_token`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${baseReturn}?gsc_error=unauthorized`);

  const encryptedToken = encryptCredential(tokens.refresh_token);

  const { data: existing } = await supabase
    .from("user_settings").select("id").eq("user_id", user.id).single();

  const patch = { gsc_refresh_token: encryptedToken, updated_at: new Date().toISOString() };
  if (existing) {
    await supabase.from("user_settings").update(patch).eq("user_id", user.id);
  } else {
    await supabase.from("user_settings").insert({ user_id: user.id, ...patch });
  }

  const successResponse = NextResponse.redirect(`${baseReturn}?gsc_connected=1`);
  successResponse.cookies.delete("gsc_oauth_state");
  successResponse.cookies.delete("gsc_return_to");
  return successResponse;
}
