-- Security fixes migration
-- 1. Prevent privilege escalation via user_profiles UPDATE
-- 2. Add Stripe webhook event deduplication table

-- ── 1. Privilege escalation fix ──────────────────────────────────────────────
-- The existing UPDATE policy has no WITH CHECK clause, allowing users to set
-- their own role to 'admin'. Replace it with a policy that enforces role is
-- unchanged for non-admin updates (admin updates go through service role key
-- and bypass RLS entirely).

drop policy if exists "Users can update own profile" on user_profiles;

create policy "Users can update own profile" on user_profiles
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    -- Prevent users from changing their own role
    and role = (select role from user_profiles where user_id = auth.uid())
  );

-- ── 2. Stripe webhook event deduplication ────────────────────────────────────
-- Tracks processed Stripe event IDs to prevent duplicate processing on retries.

create table if not exists stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- Auto-expire old records after 30 days (kept for audit purposes)
-- Cleanup can be run periodically; no RLS needed as accessed only via service role.
