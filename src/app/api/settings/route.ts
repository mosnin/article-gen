import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { encryptCredential, decryptCredential, isEncrypted } from "@/lib/wp-crypto";
import { logger } from "@/lib/logger";
import type {
  ShopifyAccount,
  MediumAccount,
  GhostBlog,
  DevToAccount,
} from "@/lib/publish-platforms";

export interface Preset {
  id: string;
  name: string;
  quality: "standard" | "premium";
  wordCount: number;
  withImages: boolean;
  tone?: string;
  targetAudience?: string;
  defaultBlogId?: string;
}

interface WpBlog {
  id: string;
  name: string;
  url: string;
  username: string;
  appPassword: string;
  authorName?: string;
  authorAbout?: string;
}

// ── WordPress ──────────────────────────────────────────────────────────────

function encryptBlogPasswords(blogs: WpBlog[]): WpBlog[] {
  return blogs.map((b) => ({
    ...b,
    appPassword: b.appPassword && !isEncrypted(b.appPassword)
      ? encryptCredential(b.appPassword)
      : b.appPassword ?? "",
  }));
}

function decryptBlogPasswords(blogs: WpBlog[]): WpBlog[] {
  return blogs.map((b) => ({
    ...b,
    appPassword: b.appPassword ? decryptCredential(b.appPassword) : "",
  }));
}

// ── Shopify ────────────────────────────────────────────────────────────────

function encryptShopifyAccounts(accounts: ShopifyAccount[]): ShopifyAccount[] {
  return accounts.map((a) => ({
    ...a,
    accessToken: a.accessToken && !isEncrypted(a.accessToken)
      ? encryptCredential(a.accessToken)
      : a.accessToken ?? "",
  }));
}

function decryptShopifyAccounts(accounts: ShopifyAccount[]): ShopifyAccount[] {
  return accounts.map((a) => ({
    ...a,
    accessToken: a.accessToken ? decryptCredential(a.accessToken) : "",
  }));
}

// ── Medium ─────────────────────────────────────────────────────────────────

function encryptMediumAccounts(accounts: MediumAccount[]): MediumAccount[] {
  return accounts.map((a) => ({
    ...a,
    integrationToken: a.integrationToken && !isEncrypted(a.integrationToken)
      ? encryptCredential(a.integrationToken)
      : a.integrationToken ?? "",
  }));
}

function decryptMediumAccounts(accounts: MediumAccount[]): MediumAccount[] {
  return accounts.map((a) => ({
    ...a,
    integrationToken: a.integrationToken ? decryptCredential(a.integrationToken) : "",
  }));
}

// ── Ghost ──────────────────────────────────────────────────────────────────

function encryptGhostBlogs(blogs: GhostBlog[]): GhostBlog[] {
  return blogs.map((b) => ({
    ...b,
    adminApiKey: b.adminApiKey && !isEncrypted(b.adminApiKey)
      ? encryptCredential(b.adminApiKey)
      : b.adminApiKey ?? "",
  }));
}

function decryptGhostBlogs(blogs: GhostBlog[]): GhostBlog[] {
  return blogs.map((b) => ({
    ...b,
    adminApiKey: b.adminApiKey ? decryptCredential(b.adminApiKey) : "",
  }));
}

// ── Dev.to ─────────────────────────────────────────────────────────────────

function encryptDevToAccounts(accounts: DevToAccount[]): DevToAccount[] {
  return accounts.map((a) => ({
    ...a,
    apiKey: a.apiKey && !isEncrypted(a.apiKey)
      ? encryptCredential(a.apiKey)
      : a.apiKey ?? "",
  }));
}

function decryptDevToAccounts(accounts: DevToAccount[]): DevToAccount[] {
  return accounts.map((a) => ({
    ...a,
    apiKey: a.apiKey ? decryptCredential(a.apiKey) : "",
  }));
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: settings, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("Failed to fetch user settings", error, { userId: user.id, errorCode: error.code });
      return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
    }
    if (!settings) return NextResponse.json({ settings: null });

    return NextResponse.json({
      settings: {
        ...settings,
        // WordPress
        wp_blogs: Array.isArray(settings.wp_blogs)
          ? decryptBlogPasswords(settings.wp_blogs as WpBlog[])
          : [],
        wp_app_password: settings.wp_app_password
          ? decryptCredential(settings.wp_app_password as string)
          : "",
        // Shopify
        shopify_accounts: Array.isArray(settings.shopify_accounts)
          ? decryptShopifyAccounts(settings.shopify_accounts as ShopifyAccount[])
          : [],
        // Medium
        medium_accounts: Array.isArray(settings.medium_accounts)
          ? decryptMediumAccounts(settings.medium_accounts as MediumAccount[])
          : [],
        // Ghost
        ghost_blogs: Array.isArray(settings.ghost_blogs)
          ? decryptGhostBlogs(settings.ghost_blogs as GhostBlog[])
          : [],
        // Dev.to
        devto_accounts: Array.isArray(settings.devto_accounts)
          ? decryptDevToAccounts(settings.devto_accounts as DevToAccount[])
          : [],
        // Presets (stored as-is, no encryption needed)
        presets: Array.isArray(settings.presets) ? settings.presets : [],
        // GSC (only expose whether connected + site url, never the token)
        gsc_connected: !!settings.gsc_refresh_token,
        gsc_site_url: settings.gsc_site_url ?? "",
      },
    });
  } catch (error: unknown) {
    logger.error("Unexpected error in GET /api/settings", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const wpBlogs = encryptBlogPasswords(
      ((body.wp_blogs as WpBlog[]) ?? []).filter((b) => b.url?.trim())
    );
    const firstBlog = wpBlogs[0] as WpBlog | undefined;

    const shopifyAccounts = encryptShopifyAccounts(
      ((body.shopify_accounts as ShopifyAccount[]) ?? []).filter((a) => a.shopDomain?.trim())
    );
    const mediumAccounts = encryptMediumAccounts(
      ((body.medium_accounts as MediumAccount[]) ?? []).filter((a) => a.integrationToken?.trim())
    );
    const ghostBlogs = encryptGhostBlogs(
      ((body.ghost_blogs as GhostBlog[]) ?? []).filter((b) => b.url?.trim())
    );
    const devtoAccounts = encryptDevToAccounts(
      ((body.devto_accounts as DevToAccount[]) ?? []).filter((a) => a.apiKey?.trim())
    );

    const payload: Record<string, unknown> = {
      domain: body.domain ?? "",
      site_name: body.site_name ?? "",
      site_about: body.site_about ?? "",
      author_name: body.author_name ?? "",
      author_about: body.author_about ?? "",
      // WordPress
      wp_blogs: wpBlogs,
      wp_url: firstBlog?.url ?? "",
      wp_username: firstBlog?.username ?? "",
      wp_app_password: firstBlog?.appPassword ?? "",
      // Other platforms
      shopify_accounts: shopifyAccounts,
      medium_accounts: mediumAccounts,
      ghost_blogs: ghostBlogs,
      devto_accounts: devtoAccounts,
      // Presets
      presets: Array.isArray(body.presets) ? body.presets : [],
      updated_at: new Date().toISOString(),
    };

    // GSC site_url update (token is written by the callback route, not here)
    if (typeof body.gsc_site_url === "string") {
      payload.gsc_site_url = body.gsc_site_url;
    }

    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const { error } = existing
      ? await supabase.from("user_settings").update(payload).eq("user_id", user.id)
      : await supabase.from("user_settings").insert({ user_id: user.id, ...payload });

    if (error) {
      logger.error("Failed to save user settings", error, { userId: user.id, errorCode: error.code });
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
