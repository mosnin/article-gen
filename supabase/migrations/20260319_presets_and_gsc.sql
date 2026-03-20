-- Article generation presets (named configs for quick generation)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS presets JSONB DEFAULT '[]';

COMMENT ON COLUMN user_settings.presets IS
  'Array of named generation presets: [{id, name, quality, wordCount, withImages, tone, targetAudience, defaultBlogId}]';

-- Google Search Console OAuth tokens
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS gsc_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS gsc_site_url TEXT;

COMMENT ON COLUMN user_settings.gsc_refresh_token IS 'Encrypted GSC OAuth refresh token';
COMMENT ON COLUMN user_settings.gsc_site_url IS 'Selected GSC property URL (e.g. sc-domain:example.com)';
