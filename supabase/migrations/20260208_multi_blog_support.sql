-- Multi-blog support migration
-- Adds wp_blogs JSONB column to user_settings for storing up to 3 WordPress blogs
-- Adds wp_blog_id to articles for associating articles with specific blogs

-- Add wp_blogs column to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS wp_blogs jsonb DEFAULT '[]';

-- Add wp_blog_id column to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS wp_blog_id text;
