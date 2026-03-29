-- ============================================================================
-- Add missing core user_settings columns that the settings API writes to
-- All statements are idempotent (safe to re-run)
-- ============================================================================

-- Core site identity fields (written by onboarding + general settings)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS site_name TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS site_about TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS author_about TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS niche TEXT;

-- Audience & competitor data
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS target_audiences JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS competitors JSONB DEFAULT '[]'::jsonb;

-- WordPress legacy single-blog columns (may already exist in older installs)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS wp_url TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS wp_username TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS wp_app_password TEXT;
