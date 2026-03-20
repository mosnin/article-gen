ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_platform TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_account_id TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_options JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS articles_publish_at_idx
  ON articles(publish_at)
  WHERE publish_at IS NOT NULL AND posted = false;
