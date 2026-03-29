-- Drop the overly broad service role policy and replace with proper admin access
-- The embeddings are written server-side via supabase-admin client which bypasses RLS anyway.
-- This policy ensures the admin client can always write.

drop policy if exists "Service role bypass" on public.article_embeddings;

-- Allow service_role to do everything (needed for server-side writes)
create policy "Service role full access"
  on public.article_embeddings for all
  to service_role
  using (true)
  with check (true);
