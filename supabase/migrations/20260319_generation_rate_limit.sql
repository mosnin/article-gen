-- Track concurrent AI generations per user to prevent API abuse.
-- Max concurrent generations are enforced by acquire_generation_slot.
--
-- Usage:
--   SELECT acquire_generation_slot('<user_uuid>');  -- returns TRUE if acquired
--   SELECT release_generation_slot('<user_uuid>');  -- always call in finally

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS active_generations INT NOT NULL DEFAULT 0;

-- Clamp any existing negative values (defensive)
UPDATE user_profiles SET active_generations = 0 WHERE active_generations < 0;

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS active_generations_non_negative;

ALTER TABLE user_profiles
  ADD CONSTRAINT active_generations_non_negative CHECK (active_generations >= 0);

-- Atomically acquires one generation slot.
-- Returns TRUE if the slot was acquired (active_generations incremented).
-- Returns FALSE if the user is already at the limit or the user is not found.
-- Admins are exempt from the limit (role = 'admin' bypasses).
CREATE OR REPLACE FUNCTION acquire_generation_slot(
  p_user_id UUID,
  p_max     INT DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE user_profiles
  SET
    active_generations = active_generations + 1,
    updated_at         = now()
  WHERE user_id = p_user_id
    AND (active_generations < p_max OR role = 'admin');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Decrements the active generation counter, floored at 0.
-- Safe to call even if the slot was never acquired (no-op).
CREATE OR REPLACE FUNCTION release_generation_slot(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_profiles
  SET
    active_generations = GREATEST(0, active_generations - 1),
    updated_at         = now()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION acquire_generation_slot(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_generation_slot(UUID)       TO authenticated;
