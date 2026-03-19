-- Add multi-platform publishing support to user_settings.
-- Each column holds a JSONB array of platform account objects.
-- Credentials inside each object are AES-256-GCM encrypted at the app layer.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS shopify_accounts JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS medium_accounts  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ghost_blogs      JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS devto_accounts   JSONB NOT NULL DEFAULT '[]';

-- Add a generic published_platform column to articles so each article
-- records which platform it was last published to (nullable).
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS published_platform TEXT;

COMMENT ON COLUMN user_settings.shopify_accounts IS
  'Array of {id,name,shopDomain,accessToken} — accessToken is enc:-prefixed AES-256-GCM ciphertext';
COMMENT ON COLUMN user_settings.medium_accounts IS
  'Array of {id,name,integrationToken} — token is enc:-prefixed AES-256-GCM ciphertext';
COMMENT ON COLUMN user_settings.ghost_blogs IS
  'Array of {id,name,url,adminApiKey} — adminApiKey is enc:-prefixed AES-256-GCM ciphertext';
COMMENT ON COLUMN user_settings.devto_accounts IS
  'Array of {id,name,apiKey} — apiKey is enc:-prefixed AES-256-GCM ciphertext';
