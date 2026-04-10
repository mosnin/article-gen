-- ============================================================================
-- FULL SCHEMA SYNC — Run this in Supabase SQL Editor
-- Brings the database up to date with the codebase
-- All statements are idempotent (safe to re-run)
-- ============================================================================

-- ── Articles table: scheduling & publishing columns ─────────────────────────

ALTER TABLE articles ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_platform TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_account_id TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_options JSONB DEFAULT '{}'::jsonb;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_platform TEXT;

-- ── User Settings: platform integrations ────────────────────────────────────

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS shopify_accounts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS medium_accounts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ghost_blogs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS devto_accounts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS webhook_endpoints JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS webflow_sites JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notion_connections JSONB DEFAULT '[]'::jsonb;

-- ── User Settings: GSC (Google Search Console) ─────────────────────────────

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS gsc_refresh_token TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS gsc_site_url TEXT;

-- ── User Settings: presets, team, autopilot ─────────────────────────────────

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS presets JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS team_invites JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS autopilot_plan JSONB;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS autopilot_niche TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS autopilot_last_generated TIMESTAMPTZ;

-- ── User Profiles: onboarding & rate limiting ───────────────────────────────

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS active_generations INT DEFAULT 0;

-- ── Publish Logs table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS publish_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  account_name TEXT,
  post_url TEXT,
  edit_url TEXT,
  post_id TEXT,
  published_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE publish_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'publish_logs' AND policyname = 'Users can view own publish logs'
  ) THEN
    CREATE POLICY "Users can view own publish logs" ON publish_logs
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'publish_logs' AND policyname = 'Users can insert own publish logs'
  ) THEN
    CREATE POLICY "Users can insert own publish logs" ON publish_logs
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── Stripe Webhook Deduplication table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- ── Atomic Credit Deduction function ────────────────────────────────────────

CREATE OR REPLACE FUNCTION deduct_credit_atomic(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE user_profiles
  SET credits = credits - 1, updated_at = now()
  WHERE user_id = p_user_id AND credits > 0;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

-- ── Generation Rate Limiting functions ──────────────────────────────────────

CREATE OR REPLACE FUNCTION acquire_generation_slot(p_user_id UUID, p_max_slots INT DEFAULT 3)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE user_profiles
  SET active_generations = active_generations + 1, updated_at = now()
  WHERE user_id = p_user_id AND active_generations < p_max_slots;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

CREATE OR REPLACE FUNCTION release_generation_slot(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET active_generations = GREATEST(active_generations - 1, 0), updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- ── Security: prevent role escalation via RLS ───────────────────────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile'
  ) THEN
    DROP POLICY "Users can update own profile" ON user_profiles;
  END IF;
END $$;

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT role FROM user_profiles WHERE user_id = auth.uid())
  );

-- ── Indexes for performance ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_articles_publish_at ON articles(publish_at) WHERE publish_at IS NOT NULL AND posted = false;
CREATE INDEX IF NOT EXISTS idx_publish_logs_user_id ON publish_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_publish_logs_article_id ON publish_logs(article_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed_at);
