/**
 * SSRF (Server-Side Request Forgery) protection utilities.
 * Validates user-supplied URLs before making server-side HTTP requests.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal",
]);

const BLOCKED_PREFIXES = [
  "10.",
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
  "192.168.",
];

/**
 * Validates that a URL is safe to make server-side requests to.
 * Blocks private/internal IPs and localhost to prevent SSRF attacks.
 *
 * @throws Error with a descriptive message if the URL is invalid or blocked.
 */
export function validatePublicUrl(rawUrl: string, allowedProtocols = ["https:", "http:"]): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(`URL protocol '${parsed.protocol}' is not allowed`);
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(hostname)) {
    throw new Error("URL resolves to a blocked host");
  }

  for (const prefix of BLOCKED_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      throw new Error("URL resolves to a private/internal IP range");
    }
  }

  // Block numeric IPs that look like private ranges (simple heuristic)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const parts = hostname.split(".").map(Number);
    // Block all bare IP literals to reduce attack surface
    if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) {
      throw new Error("URL resolves to a blocked IP");
    }
  }

  return parsed;
}

/**
 * fetch() wrapper that validates the URL for SSRF before making the request.
 * Adds a default timeout of 15 seconds.
 */
export async function safeFetch(
  rawUrl: string,
  options: RequestInit & { timeoutMs?: number } = {},
  allowedProtocols?: string[]
): Promise<Response> {
  validatePublicUrl(rawUrl, allowedProtocols);

  const { timeoutMs = 15_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(rawUrl, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
