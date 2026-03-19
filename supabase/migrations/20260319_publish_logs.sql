-- Publish activity log: one row per successful publish event.
-- Allows users to see where and when each article was published.

CREATE TABLE IF NOT EXISTS publish_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,          -- 'wordpress' | 'shopify' | 'medium' | 'ghost' | 'devto'
  account_name TEXT,                  -- human-readable account / blog name
  post_url    TEXT,                   -- public URL of the published post
  edit_url    TEXT,                   -- back-end edit URL (if available)
  post_id     TEXT,                   -- platform's post/article ID
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can only see their own logs
ALTER TABLE publish_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own publish logs"
  ON publish_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own publish logs"
  ON publish_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for the most common query pattern (latest logs for a user or article)
CREATE INDEX publish_logs_user_id_idx     ON publish_logs(user_id, published_at DESC);
CREATE INDEX publish_logs_article_id_idx  ON publish_logs(article_id, published_at DESC);
