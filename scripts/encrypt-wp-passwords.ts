/**
 * One-time migration script: encrypt plaintext WordPress app passwords.
 *
 * Reads every row in user_settings, identifies any wp_app_password or
 * wp_blogs[*].appPassword that isn't already encrypted (no "enc:" prefix),
 * encrypts them, and writes the row back.
 *
 * Run once after deploying the WP_ENCRYPTION_KEY env var:
 *
 *   WP_ENCRYPTION_KEY=<key> \
 *   NEXT_PUBLIC_SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   npx ts-node --project tsconfig.json scripts/encrypt-wp-passwords.ts
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
  authorName?: string;
  authorAbout?: string;
}

interface UserSettingsRow {
  id: string;
  user_id: string;
  wp_app_password: string | null;
  wp_blogs: WpBlog[] | null;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
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

  // Fetch all rows (service role bypasses RLS)
  const { data: rows, error } = await supabase
    .from("user_settings")
    .select("id, user_id, wp_app_password, wp_blogs");

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
    const patch: Partial<UserSettingsRow & { updated_at: string }> = {};

    // --- Legacy single-blog field ---
    if (row.wp_app_password && !isEncrypted(row.wp_app_password)) {
      patch.wp_app_password = encryptCredential(row.wp_app_password);
      changed = true;
    }

    // --- Multi-blog JSON array ---
    if (Array.isArray(row.wp_blogs) && row.wp_blogs.length > 0) {
      const encryptedBlogs = row.wp_blogs.map((blog) => {
        if (blog.appPassword && !isEncrypted(blog.appPassword)) {
          changed = true;
          return { ...blog, appPassword: encryptCredential(blog.appPassword) };
        }
        return blog;
      });

      if (changed) {
        patch.wp_blogs = encryptedBlogs;
      }
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
      console.log(`  ✓ user_id=${row.user_id}: passwords encrypted`);
      updated++;
    }
  }

  console.log(`\nDone. ${updated} row(s) updated, ${skipped} already encrypted.`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
