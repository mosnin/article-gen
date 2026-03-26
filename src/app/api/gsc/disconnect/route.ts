import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch the current token before clearing it so we can revoke it at Google
    const { data: settings } = await supabase
      .from("user_settings")
      .select("gsc_refresh_token")
      .eq("user_id", user.id)
      .single();

    if (settings?.gsc_refresh_token) {
      try {
        const refreshToken = decryptCredential(settings.gsc_refresh_token as string);
        // Revoke the token at Google — best-effort, ignore failures
        // (token may already be revoked or expired)
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken }).toString(),
        });
      } catch {
        // Ignore revocation errors — proceed to clear the token from DB regardless
      }
    }

    await supabase
      .from("user_settings")
      .update({ gsc_refresh_token: null, gsc_site_url: null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
