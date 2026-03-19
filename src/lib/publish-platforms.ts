/**
 * Shared types and utilities for multi-platform publishing.
 * Each platform credential object uses the same encrypted-at-rest pattern
 * as WordPress — encryptCredential() before storing, decryptCredential()
 * before use.
 */

import crypto from "crypto";

export interface ShopifyAccount {
  id: string;
  name: string;
  shopDomain: string;  // e.g. "mystore.myshopify.com"
  accessToken: string; // Shopify Admin API access token (enc:...)
}

export interface MediumAccount {
  id: string;
  name: string;
  integrationToken: string; // Medium integration token (enc:...)
}

export interface GhostBlog {
  id: string;
  name: string;
  url: string;          // e.g. "https://myblog.ghost.io"
  adminApiKey: string;  // Format: "keyId:secret" (enc:...)
}

export interface DevToAccount {
  id: string;
  name: string;
  apiKey: string; // Dev.to API key (enc:...)
}

/** All platform credential collections, as stored in user_settings. */
export interface PlatformSettings {
  shopify_accounts?: ShopifyAccount[];
  medium_accounts?: MediumAccount[];
  ghost_blogs?: GhostBlog[];
  devto_accounts?: DevToAccount[];
}

/**
 * Creates a Ghost Admin API JWT without any external dependencies.
 * Implements HS256 using Node's built-in crypto module.
 *
 * @param adminApiKey  "keyId:hexSecret" from Ghost Admin API settings
 */
export function createGhostJwt(adminApiKey: string): string {
  const [id, secret] = adminApiKey.split(":");
  if (!id || !secret) throw new Error("Invalid Ghost Admin API key format (expected id:secret)");

  const now = Math.floor(Date.now() / 1000);

  const headerB64 = Buffer.from(JSON.stringify({ alg: "HS256", kid: id, typ: "JWT" })).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" })).toString("base64url");

  const sig = crypto
    .createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  return `${headerB64}.${payloadB64}.${sig}`;
}
