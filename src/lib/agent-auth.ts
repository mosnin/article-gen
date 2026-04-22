import crypto from "node:crypto";

export function signBody(body: string | Buffer, secret: string): string {
  const raw = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  return "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

export function verifyHmac(rawBody: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader || !secret) return false;
  const expected = signBody(rawBody, secret);
  if (expected.length !== sigHeader.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader));
  } catch {
    return false;
  }
}

export type InternalAuth = {
  rawBody: string;
  runId: string;
};

/** Verifies the Authorization bearer, HMAC signature, and returns the raw body + runId.
 *  Returns null on any failure. */
export async function requireInternalAuth(req: Request): Promise<InternalAuth | null> {
  const secret = process.env.AGENT_INTERNAL_SECRET;
  if (!secret) return null;
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) return null;
  const rawBody = await req.text();
  const sig = req.headers.get("x-signature");
  if (!verifyHmac(rawBody, sig, secret)) return null;
  const runId = req.headers.get("x-agent-run-id") || "";
  return { rawBody, runId };
}

/** Verifies the webhook HMAC (separate secret: AGENT_WEBHOOK_SECRET). */
export async function requireWebhookAuth(req: Request): Promise<InternalAuth | null> {
  const secret = process.env.AGENT_WEBHOOK_SECRET;
  if (!secret) return null;
  const rawBody = await req.text();
  const sig = req.headers.get("x-signature");
  if (!verifyHmac(rawBody, sig, secret)) return null;
  const runId = req.headers.get("x-agent-run-id") || "";
  return { rawBody, runId };
}
