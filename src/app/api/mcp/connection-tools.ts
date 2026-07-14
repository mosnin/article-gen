import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import crypto from "crypto";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { encryptCredential, decryptCredential } from "@/lib/wp-crypto";
import { createGhostJwt } from "@/lib/publish-platforms";
import { safeFetch, validatePublicUrl } from "@/lib/ssrf";
import { defineTool, jsonResult, errorResult } from "@/lib/mcp/context";
import type { McpAuth } from "@/lib/mcp/auth";

/**
 * Remote blog-connection management.
 *
 * Credentials are AES-256-GCM encrypted (WP_ENCRYPTION_KEY) before they are
 * stored, exactly like the Settings UI does, and are NEVER returned by any
 * tool — list/test responses only carry non-secret fields and booleans.
 * User-supplied URLs are SSRF-validated before any fetch.
 */

const PLATFORMS = ["wordpress", "ghost", "medium", "shopify", "devto", "webhook"] as const;
type ConnPlatform = (typeof PLATFORMS)[number];

const COLUMN: Record<ConnPlatform, string> = {
  wordpress: "wp_blogs",
  ghost: "ghost_blogs",
  medium: "medium_accounts",
  shopify: "shopify_accounts",
  devto: "devto_accounts",
  webhook: "webhook_endpoints",
};

type ConnRecord = Record<string, unknown> & { id: string };

async function loadConnections(userId: string, platform: ConnPlatform): Promise<ConnRecord[]> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("user_settings")
    .select(COLUMN[platform])
    .eq("user_id", userId)
    .maybeSingle();
  const arr = (data as Record<string, unknown> | null)?.[COLUMN[platform]];
  return Array.isArray(arr) ? (arr as ConnRecord[]) : [];
}

async function saveConnections(userId: string, platform: ConnPlatform, connections: ConnRecord[]): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from("user_settings")
    .upsert({ user_id: userId, [COLUMN[platform]]: connections }, { onConflict: "user_id" });
  if (error) throw new Error(`Failed to save connection: ${error.message}`);
}

/** Strip secrets for output. */
function sanitize(platform: ConnPlatform, c: ConnRecord): Record<string, unknown> {
  const base = { id: c.id, name: c.name ?? "" };
  switch (platform) {
    case "wordpress":
      return { ...base, url: c.url, username: c.username, hasCredentials: Boolean(c.appPassword) };
    case "ghost":
      return { ...base, url: c.url, hasCredentials: Boolean(c.adminApiKey) };
    case "medium":
      return { ...base, hasCredentials: Boolean(c.integrationToken) };
    case "shopify":
      return { ...base, shopDomain: c.shopDomain, hasCredentials: Boolean(c.accessToken) };
    case "devto":
      return { ...base, hasCredentials: Boolean(c.apiKey) };
    case "webhook":
      return { ...base, url: c.url, format: c.format ?? "markdown", signed: Boolean(c.secret) };
  }
}

/** Per-platform field validation + credential encryption for create/update. */
function buildRecord(
  platform: ConnPlatform,
  fields: {
    name?: string; url?: string; username?: string; app_password?: string;
    admin_api_key?: string; integration_token?: string; shop_domain?: string;
    access_token?: string; api_key?: string; webhook_secret?: string;
    webhook_format?: "json" | "html" | "markdown";
  },
  existing?: ConnRecord,
): ConnRecord | { error: string } {
  const rec: ConnRecord = existing ? { ...existing } : { id: crypto.randomUUID() };
  if (fields.name !== undefined) rec.name = fields.name;

  const need = (cond: unknown, msg: string) => (cond ? null : msg);
  const enc = (v: string) => encryptCredential(v);

  switch (platform) {
    case "wordpress": {
      if (fields.url !== undefined) {
        try { validatePublicUrl(fields.url); } catch (e) { return { error: `Invalid URL: ${(e as Error).message}` }; }
        rec.url = fields.url.replace(/\/$/, "");
      }
      if (fields.username !== undefined) rec.username = fields.username;
      if (fields.app_password !== undefined) rec.appPassword = enc(fields.app_password);
      const missing = need(rec.url, "url is required") ?? need(rec.username, "username is required") ?? need(rec.appPassword, "app_password is required");
      if (!existing && missing) return { error: missing };
      break;
    }
    case "ghost": {
      if (fields.url !== undefined) {
        try { validatePublicUrl(fields.url); } catch (e) { return { error: `Invalid URL: ${(e as Error).message}` }; }
        rec.url = fields.url.replace(/\/$/, "");
      }
      if (fields.admin_api_key !== undefined) {
        if (!/^[0-9a-f]+:[0-9a-f]+$/i.test(fields.admin_api_key)) return { error: "admin_api_key must be in id:secret format" };
        rec.adminApiKey = enc(fields.admin_api_key);
      }
      const missing = need(rec.url, "url is required") ?? need(rec.adminApiKey, "admin_api_key is required");
      if (!existing && missing) return { error: missing };
      break;
    }
    case "medium": {
      if (fields.integration_token !== undefined) rec.integrationToken = enc(fields.integration_token);
      if (!existing && !rec.integrationToken) return { error: "integration_token is required" };
      break;
    }
    case "shopify": {
      if (fields.shop_domain !== undefined) {
        if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(fields.shop_domain)) return { error: "shop_domain must look like mystore.myshopify.com" };
        rec.shopDomain = fields.shop_domain.toLowerCase();
      }
      if (fields.access_token !== undefined) rec.accessToken = enc(fields.access_token);
      const missing = need(rec.shopDomain, "shop_domain is required") ?? need(rec.accessToken, "access_token is required");
      if (!existing && missing) return { error: missing };
      break;
    }
    case "devto": {
      if (fields.api_key !== undefined) rec.apiKey = enc(fields.api_key);
      if (!existing && !rec.apiKey) return { error: "api_key is required" };
      break;
    }
    case "webhook": {
      if (fields.url !== undefined) {
        try { validatePublicUrl(fields.url); } catch (e) { return { error: `Invalid URL: ${(e as Error).message}` }; }
        rec.url = fields.url;
      }
      if (fields.webhook_secret !== undefined) rec.secret = fields.webhook_secret;
      if (fields.webhook_format !== undefined) rec.format = fields.webhook_format;
      if (!rec.format) rec.format = "markdown";
      if (!existing && !rec.url) return { error: "url is required" };
      break;
    }
  }
  return rec;
}

async function testConnection(platform: ConnPlatform, c: ConnRecord): Promise<{ ok: boolean; message: string }> {
  try {
    switch (platform) {
      case "wordpress": {
        const url = String(c.url ?? "").replace(/\/$/, "");
        validatePublicUrl(url);
        const basic = Buffer.from(`${c.username}:${decryptCredential(String(c.appPassword ?? ""))}`).toString("base64");
        const res = await safeFetch(`${url}/wp-json/wp/v2/users/me`, {
          headers: { Authorization: `Basic ${basic}` },
          timeoutMs: 10_000,
        });
        if (res.status === 401 || res.status === 403) return { ok: false, message: "Authentication failed — check username/app password" };
        if (!res.ok) return { ok: false, message: `WordPress returned ${res.status}` };
        const me = await res.json() as { name?: string };
        return { ok: true, message: `Connected as ${me.name ?? c.username}` };
      }
      case "ghost": {
        const url = String(c.url ?? "").replace(/\/$/, "");
        validatePublicUrl(url);
        const jwt = createGhostJwt(decryptCredential(String(c.adminApiKey ?? "")));
        const res = await safeFetch(`${url}/ghost/api/admin/site/`, {
          headers: { Authorization: `Ghost ${jwt}`, "Accept-Version": "v5.0" },
          timeoutMs: 10_000,
        });
        if (res.status === 401 || res.status === 403) return { ok: false, message: "Authentication failed — check the Admin API key" };
        if (!res.ok) return { ok: false, message: `Ghost returned ${res.status}` };
        const data = await res.json() as { site?: { title?: string } };
        return { ok: true, message: `Connected to "${data.site?.title ?? url}"` };
      }
      case "medium": {
        const res = await fetch("https://api.medium.com/v1/me", {
          headers: { Authorization: `Bearer ${decryptCredential(String(c.integrationToken ?? ""))}` },
        });
        if (!res.ok) return { ok: false, message: `Medium returned ${res.status} — check the integration token` };
        const data = await res.json() as { data?: { username?: string } };
        return { ok: true, message: `Connected as @${data.data?.username ?? "unknown"}` };
      }
      case "shopify": {
        const res = await fetch(`https://${c.shopDomain}/admin/api/2024-04/shop.json`, {
          headers: { "X-Shopify-Access-Token": decryptCredential(String(c.accessToken ?? "")) },
        });
        if (res.status === 401 || res.status === 403) return { ok: false, message: "Authentication failed — check the access token" };
        if (!res.ok) return { ok: false, message: `Shopify returned ${res.status}` };
        const data = await res.json() as { shop?: { name?: string } };
        return { ok: true, message: `Connected to "${data.shop?.name ?? c.shopDomain}"` };
      }
      case "devto": {
        const res = await fetch("https://dev.to/api/users/me", {
          headers: { "api-key": decryptCredential(String(c.apiKey ?? "")) },
        });
        if (!res.ok) return { ok: false, message: `Dev.to returned ${res.status} — check the API key` };
        const data = await res.json() as { username?: string };
        return { ok: true, message: `Connected as @${data.username ?? "unknown"}` };
      }
      case "webhook": {
        validatePublicUrl(String(c.url ?? ""));
        return { ok: true, message: "URL is valid and publicly reachable per SSRF policy (no test payload sent)" };
      }
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export function registerConnectionTools(server: McpServer, auth: McpAuth) {
  defineTool(server, auth, {
    name: "list_connections",
    description:
      "List all publishing connections (WordPress, Ghost, Medium, Shopify, Dev.to, custom webhooks). Credentials are never included.",
    scope: "read",
    schema: {},
    handler: async () => {
      const result: Record<string, unknown[]> = {};
      for (const p of PLATFORMS) {
        const conns = await loadConnections(auth.userId, p);
        result[p] = conns.map((c) => sanitize(p, c));
      }
      return jsonResult(result);
    },
  });

  defineTool(server, auth, {
    name: "add_blog_connection",
    description:
      "Connect a blog/platform for publishing. Provide the fields for the chosen platform: wordpress(url, username, app_password), ghost(url, admin_api_key as id:secret), medium(integration_token), shopify(shop_domain, access_token), devto(api_key), webhook(url, optional webhook_secret + webhook_format). Credentials are encrypted at rest and the connection is test-verified before saving.",
    scope: "connections",
    schema: {
      platform: z.enum(PLATFORMS),
      name: z.string().max(100).default(""),
      url: z.string().max(500).optional(),
      username: z.string().max(200).optional(),
      app_password: z.string().max(500).optional(),
      admin_api_key: z.string().max(500).optional(),
      integration_token: z.string().max(500).optional(),
      shop_domain: z.string().max(200).optional(),
      access_token: z.string().max(500).optional(),
      api_key: z.string().max(500).optional(),
      webhook_secret: z.string().max(500).optional(),
      webhook_format: z.enum(["json", "html", "markdown"]).optional(),
      skip_verification: z.boolean().default(false).describe("Save even if the live connection test fails"),
    },
    handler: async ({ platform, skip_verification, ...fields }) => {
      const rec = buildRecord(platform, fields);
      if ("error" in rec && typeof rec.error === "string" && !("id" in rec)) return errorResult(rec.error);
      const record = rec as ConnRecord;

      const test = await testConnection(platform, record);
      if (!test.ok && !skip_verification) {
        return errorResult(`Connection test failed: ${test.message}. Fix the credentials or pass skip_verification=true to save anyway.`);
      }

      const conns = await loadConnections(auth.userId, platform);
      conns.push(record);
      await saveConnections(auth.userId, platform, conns);
      return jsonResult({ added: true, verified: test.ok, testMessage: test.message, connection: sanitize(platform, record) });
    },
  });

  defineTool(server, auth, {
    name: "update_blog_connection",
    description: "Update an existing connection's fields. Only provided fields change; secrets are re-encrypted.",
    scope: "connections",
    schema: {
      platform: z.enum(PLATFORMS),
      connection_id: z.string(),
      name: z.string().max(100).optional(),
      url: z.string().max(500).optional(),
      username: z.string().max(200).optional(),
      app_password: z.string().max(500).optional(),
      admin_api_key: z.string().max(500).optional(),
      integration_token: z.string().max(500).optional(),
      shop_domain: z.string().max(200).optional(),
      access_token: z.string().max(500).optional(),
      api_key: z.string().max(500).optional(),
      webhook_secret: z.string().max(500).optional(),
      webhook_format: z.enum(["json", "html", "markdown"]).optional(),
    },
    handler: async ({ platform, connection_id, ...fields }) => {
      const conns = await loadConnections(auth.userId, platform);
      const idx = conns.findIndex((c) => c.id === connection_id);
      if (idx === -1) return errorResult("Connection not found");

      const rec = buildRecord(platform, fields, conns[idx]);
      if ("error" in rec && typeof rec.error === "string" && !("id" in rec)) return errorResult(rec.error);
      conns[idx] = rec as ConnRecord;
      await saveConnections(auth.userId, platform, conns);
      return jsonResult({ updated: true, connection: sanitize(platform, conns[idx]) });
    },
  });

  defineTool(server, auth, {
    name: "remove_blog_connection",
    description: "Remove a publishing connection. This does not delete anything on the remote platform.",
    scope: "connections",
    schema: { platform: z.enum(PLATFORMS), connection_id: z.string() },
    handler: async ({ platform, connection_id }) => {
      const conns = await loadConnections(auth.userId, platform);
      const next = conns.filter((c) => c.id !== connection_id);
      if (next.length === conns.length) return errorResult("Connection not found");
      await saveConnections(auth.userId, platform, next);
      return jsonResult({ removed: true, remaining: next.length });
    },
  });

  defineTool(server, auth, {
    name: "test_connection",
    description: "Live-test a saved connection's credentials against the platform.",
    scope: "connections",
    schema: {
      platform: z.enum(PLATFORMS),
      connection_id: z.string().optional().describe("Defaults to the first connection for the platform"),
    },
    handler: async ({ platform, connection_id }) => {
      const conns = await loadConnections(auth.userId, platform);
      const conn = connection_id ? conns.find((c) => c.id === connection_id) : conns[0];
      if (!conn) return errorResult("Connection not found");
      const result = await testConnection(platform, conn);
      return jsonResult({ ...result, connection: sanitize(platform, conn) });
    },
  });
}
