import { decryptCredential } from "@/lib/wp-crypto";

/**
 * Server-to-server token refresh for Google Search Console.
 * Takes the `enc:...` encrypted refresh token stored in `user_settings.gsc_refresh_token`,
 * decrypts it, and exchanges it at Google's OAuth token endpoint for a short-lived
 * access token.
 *
 * Fails closed: returns null on any error (missing env, decrypt failure, non-2xx from
 * Google, missing access_token in response). Callers should treat null as
 * "connection broken — respond as disconnected".
 */
export async function refreshGscAccessToken(
  encryptedRefreshToken: string,
): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  let refreshToken: string;
  try {
    refreshToken = decryptCredential(encryptedRefreshToken);
  } catch {
    return null;
  }
  if (!refreshToken) return null;

  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  if (!data || typeof data !== "object") return null;
  const token = (data as Record<string, unknown>).access_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}
