-- Atomic credit deduction function
-- Replaces the read-then-update pattern in src/lib/credits.ts with a single
-- round-trip UPDATE that only succeeds when credits >= 1. Returns the
-- updated row so callers know the new balance without a follow-up SELECT.
--
-- Call with: SELECT * FROM deduct_credit_atomic('<user_uuid>');
-- Returns:   success BOOLEAN, credits INT
--            success = false means the user had 0 credits (or is not found).

CREATE OR REPLACE FUNCTION deduct_credit_atomic(p_user_id UUID)
RETURNS TABLE(success BOOLEAN, credits INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_credits INT;
BEGIN
  UPDATE user_profiles
  SET
    credits     = credits - 1,
    updated_at  = now()
  WHERE user_id = p_user_id
    AND credits >= 1
    AND role    != 'admin'
  RETURNING user_profiles.credits INTO v_new_credits;

  IF v_new_credits IS NULL THEN
    -- Either 0 credits, not found, or admin (admins bypass entirely)
    RETURN QUERY SELECT FALSE, 0;
  ELSE
    RETURN QUERY SELECT TRUE, v_new_credits;
  END IF;
END;
$$;

-- Grant execute to authenticated role (Supabase uses this for logged-in users)
GRANT EXECUTE ON FUNCTION deduct_credit_atomic(UUID) TO authenticated;
