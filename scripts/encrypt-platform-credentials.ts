/**
 * One-time migration script: encrypt plaintext credentials for all publishing platforms.
 *
 * Extends the WordPress-only encrypt-wp-passwords.ts to also cover Shopify,
 * Medium, Ghost, and Dev.to credentials added in the multi-platform update.
 *
 * Reads every row in user_settings, identifies any credential that isn't
 * already encrypted (no "enc:" prefix), encrypts it, and writes back.
 *
 * Run once after deploying the WP_ENCRYPTION_KEY env var:
 *
 *   WP_ENCRYPTION_KEY=<key> \
 *   NEXT_PUBLIC_SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   npx ts-node --project tsconfig.json scripts/encrypt-platform-credentials.ts
 *
 * Safe to run multiple times — already-encrypted values are skipped.
 */

import { createClient } from "@supabase/supabase-js";
import { encryptCredential, isEncrypted } from "../src/lib/wp-crypto";

interface WpBlog {
  id: string;
  name?: string;
  url?: string;
  username?: string;
  appPassword?: string;
}

interface ShopifyAccount {
  id: string;
  name?: string;
  shopDomain?: string;
  accessToken?: string;
}

interface MediumAccount {
  id: string;
  name?: string;
  integrationToken?: string;
}

interface GhostBlog {
  id: string;
  name?: string;
  url?: string;
  adminApiKey?: string;
}

interface DevToAccount {
  id: string;
  name?: string;
  apiKey?: string;
}

interface UserSettingsRow {
  id: string;
  user_id: string;
  wp_app_password: string | null;
  wp_blogs: WpBlog[] | null;
  shopify_accounts: ShopifyAccount[] | null;
  medium_accounts: MediumAccount[] | null;
  ghost_blogs: GhostBlog[] | null;
  devto_accounts: DevToAccount[] | null;
}

function encryptIfNeeded(value: string | undefined | null): { value: string; changed: boolean } {
  if (!value || isEncrypted(value)) return { value: value ?? "", changed: false };
  return { value: encryptCredential(value), changed: true };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // Validate encryption key is present before touching any data
  try {
    encryptCredential("test");
  } catch (err) {
    console.error("WP_ENCRYPTION_KEY is missing or invalid:", (err as Error).message);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from("user_settings")
    .select("id, user_id, wp_app_password, wp_blogs, shopify_accounts, medium_accounts, ghost_blogs, devto_accounts");

  if (error) {
    console.error("Failed to fetch user_settings:", error.message);
    process.exit(1);
  }

  const settings = (rows ?? []) as UserSettingsRow[];
  console.log(`Found ${settings.length} user_settings row(s).`);

  let updated = 0;
  let skipped = 0;

  for (const row of settings) {
    let changed = false;
    const patch: Record<string, unknown> = {};

    // --- Legacy single WordPress field ---
    if (row.wp_app_password) {
      const r = encryptIfNeeded(row.wp_app_password);
      if (r.changed) { patch.wp_app_password = r.value; changed = true; }
    }

    // --- WordPress multi-blog ---
    if (Array.isArray(row.wp_blogs) && row.wp_blogs.length > 0) {
      let blogsChanged = false;
      const encryptedBlogs = row.wp_blogs.map((blog) => {
        const r = encryptIfNeeded(blog.appPassword);
        if (r.changed) { blogsChanged = true; return { ...blog, appPassword: r.value }; }
        return blog;
      });
      if (blogsChanged) { patch.wp_blogs = encryptedBlogs; changed = true; }
    }

    // --- Shopify ---
    if (Array.isArray(row.shopify_accounts) && row.shopify_accounts.length > 0) {
      let accsChanged = false;
      const encrypted = row.shopify_accounts.map((acc) => {
        const r = encryptIfNeeded(acc.accessToken);
        if (r.changed) { accsChanged = true; return { ...acc, accessToken: r.value }; }
        return acc;
      });
      if (accsChanged) { patch.shopify_accounts = encrypted; changed = true; }
    }

    // --- Medium ---
    if (Array.isArray(row.medium_accounts) && row.medium_accounts.length > 0) {
      let accsChanged = false;
      const encrypted = row.medium_accounts.map((acc) => {
        const r = encryptIfNeeded(acc.integrationToken);
        if (r.changed) { accsChanged = true; return { ...acc, integrationToken: r.value }; }
        return acc;
      });
      if (accsChanged) { patch.medium_accounts = encrypted; changed = true; }
    }

    // --- Ghost ---
    if (Array.isArray(row.ghost_blogs) && row.ghost_blogs.length > 0) {
      let blogsChanged = false;
      const encrypted = row.ghost_blogs.map((blog) => {
        const r = encryptIfNeeded(blog.adminApiKey);
        if (r.changed) { blogsChanged = true; return { ...blog, adminApiKey: r.value }; }
        return blog;
      });
      if (blogsChanged) { patch.ghost_blogs = encrypted; changed = true; }
    }

    // --- Dev.to ---
    if (Array.isArray(row.devto_accounts) && row.devto_accounts.length > 0) {
      let accsChanged = false;
      const encrypted = row.devto_accounts.map((acc) => {
        const r = encryptIfNeeded(acc.apiKey);
        if (r.changed) { accsChanged = true; return { ...acc, apiKey: r.value }; }
        return acc;
      });
      if (accsChanged) { patch.devto_accounts = encrypted; changed = true; }
    }

    if (!changed) {
      skipped++;
      continue;
    }

    patch.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("user_settings")
      .update(patch)
      .eq("id", row.id);

    if (updateError) {
      console.error(`  ✗ user_id=${row.user_id}: ${updateError.message}`);
    } else {
      const platforms = Object.keys(patch).filter((k) => k !== "updated_at").join(", ");
      console.log(`  ✓ user_id=${row.user_id}: encrypted [${platforms}]`);
      updated++;
    }
  }

  console.log(`\nDone. ${updated} row(s) updated, ${skipped} already encrypted / no credentials.`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
