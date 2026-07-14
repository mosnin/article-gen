-- MCP server v2: hashed API keys with scopes + audit log.
--
-- Keys are never stored in plaintext: only a SHA-256 hash is kept, plus a
-- short display prefix so users can recognise keys in the UI. The legacy
-- plaintext user_settings.mcp_api_key column is kept for backward
-- compatibility with keys issued before this migration; the app treats it
-- as deprecated (full-scope) and the UI only issues v2 keys.

CREATE TABLE IF NOT EXISTS mcp_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'MCP key',
  key_hash TEXT NOT NULL UNIQUE,          -- sha256 hex of the full key
  key_prefix TEXT NOT NULL,               -- e.g. "agmcp_a1b2c3" for display
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mcp_keys_user ON mcp_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_keys_hash ON mcp_keys(key_hash);

ALTER TABLE mcp_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_keys_select_own" ON mcp_keys;
CREATE POLICY "mcp_keys_select_own" ON mcp_keys
  FOR SELECT USING (auth.uid() = user_id);

-- Inserts/updates/deletes go through the service role only (API routes);
-- no user-facing write policies on purpose.

CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  key_id UUID,                            -- null for session / legacy-key auth
  tool TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  error TEXT,
  duration_ms INTEGER,
  args JSONB,                             -- redacted argument summary
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_user_time ON mcp_audit_log(user_id, created_at DESC);

ALTER TABLE mcp_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_audit_select_own" ON mcp_audit_log;
CREATE POLICY "mcp_audit_select_own" ON mcp_audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- Legacy column (plaintext key) — ensure it exists so the fallback lookup
-- and older deployments don't error; new keys never write it.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS mcp_api_key TEXT;
