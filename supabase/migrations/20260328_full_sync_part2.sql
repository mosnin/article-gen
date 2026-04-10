-- ============================================================================
-- FULL SCHEMA SYNC PART 2 — Settings pages & misc columns
-- Run this in Supabase SQL Editor right after part 1
-- All statements are idempotent (safe to re-run)
-- ============================================================================

-- ── User Settings: general settings page ────────────────────────────────────

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS general_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS audience_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS gsc_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS business_name TEXT;

-- ── User Settings: backlinks page ───────────────────────────────────────────

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS backlink_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS plan TEXT;

-- ── User Settings: article settings page ────────────────────────────────────

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS article_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS blog_settings JSONB DEFAULT '{}'::jsonb;

-- ── User Settings: internal linking page ────────────────────────────────────

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS linking_config JSONB DEFAULT '{}'::jsonb;
