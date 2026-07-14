# MCP Server v2

`/api/mcp` is a Streamable-HTTP MCP server that lets AI agents (Claude Code,
Claude Desktop, or any MCP client) operate the whole product remotely:
content, generation, publishing, blog connections, autopilot, and analytics.

## Security model

**Tenant isolation.** The server is constructed per request with the
authenticated user's identity bound into every tool handler
(`src/lib/mcp/context.ts`). No tool accepts a user id from the model — v1
took `user_id` as a tool parameter against an admin DB client, which allowed
any key holder to read or mutate any tenant's data. That class of bug is now
structurally impossible: every query filters on the identity resolved from
the credential.

**API keys** (`mcp_keys` table, managed at `/api/mcp/key` or Settings →
Claude Code):
- Format `agmcp_<48 hex>`; only a SHA-256 hash is stored. The full key is
  shown once at creation and cannot be recovered — only revoked/replaced.
- Per-key **scopes**: `read`, `generate`, `publish`, `connections`, `write`.
  Every tool declares a required scope; calls without it are refused.
- Optional expiry, instant revocation, `last_used_at` stamping, max 10
  active keys per user.
- Legacy plaintext keys (pre-v2, `user_settings.mcp_api_key`) still
  authenticate with full scopes for continuity, but creating any v2 key
  clears the legacy key, and the settings UI flags it as deprecated.

**Session auth.** Supabase session cookies also work (dashboard usage) with
full scopes; cookie-authenticated requests from a different Origin are
rejected to block CSRF riding.

**Transport encryption.** Production requests must arrive over HTTPS
(x-forwarded-proto check → 400 otherwise); keys travel only in the
`Authorization` header, never in URLs. Platform credentials supplied through
connection tools are AES-256-GCM encrypted (`WP_ENCRYPTION_KEY`) before they
touch the database — the same at-rest scheme the Settings UI uses — and no
tool response ever includes credential material (list/test return names,
URLs, and booleans only). Outbound webhook payloads are HMAC-SHA256 signed
when the endpoint has a secret.

**Rate limiting.** Per-key fixed window: 120 read calls/min, 30 mutating
calls/min (best-effort per serverless instance). Generation dispatches are
additionally bounded by the platform's credit check and the 5-concurrent-run
slot limit.

**Audit trail.** Every tool call is logged to `mcp_audit_log` (tool, key id,
outcome, duration, argument summary) with secret-looking fields redacted
before storage. Users can read their own log via RLS.

**Error containment.** Handlers never leak stack traces; failures return a
clean one-line message and are recorded in the audit log.

## Tool surface (30 tools)

| Area | Tools | Scope |
|---|---|---|
| Content | `list_articles`, `get_article`, `update_article_metadata` | read / write |
| Agent runs | `generate_article`, `run_agent_task` (15 safe kinds), `get_agent_run`, `list_agent_runs`, `cancel_agent_run` | generate / read |
| Publishing | `publish_article` (wordpress, ghost, medium, shopify, devto, webhook), `schedule_article_publish`, `cancel_scheduled_publish`, `get_publish_logs` | publish / read |
| Connections | `list_connections`, `add_blog_connection`, `update_blog_connection`, `remove_blog_connection`, `test_connection` | connections / read |
| Autopilot | `get_autopilot_plan`, `approve_autopilot_slot`, `approve_all_autopilot_slots`, `get_pending_articles` | read / write |
| Analytics | `get_article_stats`, `get_content_audit`, `get_gsc_top_keywords` | read |
| SEO research | `analyze_serp`, `get_keyword_difficulty`, `bulk_keyword_difficulty`, `find_content_gaps` | read |
| AI utilities | `generate_article_brief`, `generate_title_variations`, `generate_meta_description`, `suggest_internal_links` | generate |

Notes:
- `add_blog_connection` live-verifies credentials against the platform
  before saving (override with `skip_verification=true`), so an agent can
  walk a user through connecting a blog end-to-end and confirm it works.
- `run_agent_task` deliberately excludes internal/ops kinds
  (cost_optimize, prompt_drift_detect, user_segment, autopilot).
- Article deletion is intentionally not exposed over MCP.

## Client setup

```json
{
  "mcpServers": {
    "article-gen": {
      "type": "http",
      "url": "https://YOUR_DOMAIN/api/mcp",
      "headers": { "Authorization": "Bearer agmcp_..." }
    }
  }
}
```

Create keys in Settings → Claude Code (MCP), or via
`POST /api/mcp/key {"name": "...", "scopes": ["read","publish"], "expires_in_days": 90}`
while signed in. Revoke with `DELETE /api/mcp/key?id=<keyId>`.

## Operational notes

- Migration `20260714000000_mcp_keys_audit.sql` creates `mcp_keys` and
  `mcp_audit_log` (RLS: owner-read; writes via service role only).
- The audit log grows unbounded; if volume becomes a concern add a retention
  cron mirroring `agent-events-retention`.
- Rate-limit state is in-memory per instance — a shared store (Upstash) is
  the upgrade path if hard global limits are ever required.
