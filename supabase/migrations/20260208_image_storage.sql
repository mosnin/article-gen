-- Add generated_images column to articles table
-- Stores array of {type, altText, storagePath} for images saved in Supabase Storage
ALTER TABLE articles ADD COLUMN IF NOT EXISTS generated_images jsonb DEFAULT '[]';
