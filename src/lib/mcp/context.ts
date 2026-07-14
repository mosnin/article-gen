/**
 * Tool registration wrapper for the MCP server.
 *
 * Every tool goes through defineTool(), which enforces, in order:
 *   1. scope check against the authenticated key's grants
 *   2. per-key rate limiting (heavier limits for mutating scopes)
 *   3. audit logging (tool name, redacted args, outcome, duration)
 *   4. error containment — handlers never leak stack traces to the model
 *
 * Handlers receive the authenticated userId via ctx and MUST scope every
 * query with it. No tool accepts a user id from the model.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z, ZodRawShape } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import type { McpAuth, McpScope } from "./auth";

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

type InferShape<S extends ZodRawShape> = { [K in keyof S]: z.infer<S[K]> };

export function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
}

// ── Rate limiting ────────────────────────────────────────────────────────────
// Fixed-window, in-memory, keyed by key id (or user id for session auth).
// Best-effort on serverless (per-instance), but it still bounds burst abuse
// through any single warm instance; generation concurrency is additionally
// capped by acquireGenerationSlot in the tools that dispatch runs.

const WINDOW_MS = 60_000;
const LIMITS: Record<"read" | "mutate", number> = { read: 120, mutate: 30 };
const buckets = new Map<string, { windowStart: number; read: number; mutate: number }>();

function checkRateLimit(auth: McpAuth, scope: McpScope): boolean {
  const key = auth.keyId ?? `user:${auth.userId}`;
  const kind: "read" | "mutate" = scope === "read" ? "read" : "mutate";
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.windowStart > WINDOW_MS) {
    b = { windowStart: now, read: 0, mutate: 0 };
    buckets.set(key, b);
    if (buckets.size > 10_000) buckets.clear(); // crude memory bound
  }
  b[kind] += 1;
  return b[kind] <= LIMITS[kind];
}

// ── Audit logging ────────────────────────────────────────────────────────────

// Redact credentials AND bulk content payloads (uploaded file bodies don't
// belong in the audit log).
const SECRET_KEY_RE = /pass(word)?|token|secret|api.?key|credential|authorization|content_base64|content_text/i;
const MAX_ARG_JSON = 2_000;

export function redactArgs(args: unknown): unknown {
  if (Array.isArray(args)) return args.map(redactArgs);
  if (args && typeof args === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? "[redacted]" : redactArgs(v);
    }
    return out;
  }
  if (typeof args === "string" && args.length > 300) return args.slice(0, 300) + "…";
  return args;
}

function auditCall(auth: McpAuth, tool: string, args: unknown, ok: boolean, error: string | null, durationMs: number): void {
  try {
    let redacted = JSON.stringify(redactArgs(args));
    if (redacted.length > MAX_ARG_JSON) redacted = JSON.stringify({ truncated: true });
    void getAdminClient()
      .from("mcp_audit_log")
      .insert({
        user_id: auth.userId,
        key_id: auth.keyId,
        tool,
        ok,
        error: error ? error.slice(0, 500) : null,
        duration_ms: Math.round(durationMs),
        args: JSON.parse(redacted),
      })
      .then(() => {}, (e) => logger.error("mcp audit insert failed", e));
  } catch {
    // Auditing must never break a tool call.
  }
}

// ── Tool definition ──────────────────────────────────────────────────────────

export function defineTool<Shape extends ZodRawShape>(
  server: McpServer,
  auth: McpAuth,
  def: {
    name: string;
    description: string;
    scope: McpScope;
    schema: Shape;
    handler: (args: InferShape<Shape>, auth: McpAuth) => Promise<ToolResult>;
  },
): void {
  // The SDK's tool() overloads don't resolve against a generic Shape, so we
  // go through a loosely-typed alias; the runtime path is the documented
  // (name, description, schema, callback) form.
  const register = server.tool.bind(server) as unknown as (
    name: string,
    description: string,
    schema: ZodRawShape,
    cb: (args: InferShape<Shape>) => Promise<ToolResult>,
  ) => void;

  register(def.name, def.description, def.schema, (async (args: InferShape<Shape>) => {
    if (!auth.scopes.includes(def.scope)) {
      return errorResult(`This key does not have the '${def.scope}' scope required by ${def.name}.`);
    }
    if (!checkRateLimit(auth, def.scope)) {
      return errorResult("Rate limit exceeded. Slow down and retry shortly.");
    }
    const t0 = performance.now();
    try {
      const result = await def.handler(args, auth);
      auditCall(auth, def.name, args, !result.isError, null, performance.now() - t0);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Tool failed";
      logger.error(`mcp tool ${def.name} failed`, e);
      auditCall(auth, def.name, args, false, message, performance.now() - t0);
      // Surface a clean message only — no stack traces or internals.
      return errorResult(message);
    }
  }));
}
