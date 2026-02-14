const FALLBACK_LOCAL_URL = "http://localhost:3000";

export function getAppUrl(): string {
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || FALLBACK_LOCAL_URL;
  return raw.replace(/\/$/, "");
}
