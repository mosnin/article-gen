CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  articles_generated INT DEFAULT 0,
  articles_published INT DEFAULT 0,
  total_words INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own reports" ON content_reports FOR SELECT USING (auth.uid() = user_id);
