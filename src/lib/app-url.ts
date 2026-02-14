const FALLBACK_LOCAL_URL = "http://localhost:3000";

export function getAppUrl(): string {
  if (process.env.NODE_ENV === "production" && !process.env.APP_URL) {
    throw new Error("APP_URL must be set in production.");
  }

  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || FALLBACK_LOCAL_URL;
  return raw.replace(/\/$/, "");
}
