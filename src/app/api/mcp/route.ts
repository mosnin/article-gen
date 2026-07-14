import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { resolveMcpAuth, type McpAuth } from "@/lib/mcp/auth";
import { registerContentTools } from "./content-tools";
import { registerAgentTools } from "./agent-tools";
import { registerPublishingTools } from "./publishing-tools";
import { registerConnectionTools } from "./connection-tools";
import { registerGenerationTools } from "./generation-tools";
import { registerSeoTools } from "./seo-tools";
import { registerAnalyticsTools } from "./analytics-tools";
import { registerAutopilotTools } from "./autopilot-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The server is created per request with the authenticated identity bound
 * into every tool. Tools never accept a user id from the model; all data
 * access is scoped to auth.userId, and each tool declares a required scope
 * that is checked against the key's grants (see src/lib/mcp/context.ts).
 */
function createServer(auth: McpAuth): McpServer {
  const server = new McpServer({ name: "article-gen", version: "2.0.0" });
  registerContentTools(server, auth);
  registerAgentTools(server, auth);
  registerPublishingTools(server, auth);
  registerConnectionTools(server, auth);
  registerGenerationTools(server, auth);
  registerSeoTools(server, auth);
  registerAnalyticsTools(server, auth);
  registerAutopilotTools(server, auth);
  return server;
}

async function handleMcp(req: NextRequest): Promise<Response> {
  // Transport security: in production, refuse plaintext HTTP so credentials
  // and article data are always encrypted in transit. (Vercel/most proxies
  // terminate TLS and set x-forwarded-proto.)
  const proto = req.headers.get("x-forwarded-proto");
  const hostname = req.nextUrl.hostname;
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (process.env.NODE_ENV === "production" && !isLoopback && proto && proto !== "https") {
    return new Response(JSON.stringify({ error: "HTTPS required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fail closed: any error during credential resolution (misconfigured
  // backend, DB unavailable) reads as unauthorized rather than a 500 that
  // could leak internals.
  const auth = await resolveMcpAuth(req).catch(() => null);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" },
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = createServer(auth);
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: NextRequest) { return handleMcp(req); }
export async function GET(req: NextRequest) { return handleMcp(req); }
export async function DELETE(req: NextRequest) { return handleMcp(req); }
