-- Add team_invites column to user_settings for the team collaboration feature.
-- This is a simple invite list stored per-user. Each entry records who was invited
-- and in what status (pending/accepted). No cross-user article sharing is implemented yet.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS team_invites JSONB DEFAULT '[]';

COMMENT ON COLUMN user_settings.team_invites IS
  'Array of {id, email, role, status, invitedAt} for team member invitations';
