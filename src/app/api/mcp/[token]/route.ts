/**
 * Per-user MCP endpoint: /api/mcp/[token]
 *
 * Each user gets a personal URL like https://yourdomain.com/api/mcp/abc-123-def
 * No extra headers or API keys needed — the token in the URL identifies the user.
 *
 * The optional MCP_API_KEY env var adds a server-level guard if set (useful for
 * production Vercel deployments to prevent token enumeration).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { registerGenerationTools } from "../generation-tools";
import { registerSeoTools } from "../seo-tools";
import { registerAnalyticsTools } from "../analytics-tools";
import { registerAutopilotTools } from "../autopilot-tools";

export const maxDuration = 60;

function createServer(): McpServer {
  const server = new McpServer({ name: "article-gen", version: "1.0.0" });
  registerSeoTools(server);
  registerAnalyticsTools(server);
  registerGenerationTools(server);
  registerAutopilotTools(server);
  return server;
}

async function handleMcp(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await params;

  // Optional server-level guard (set MCP_API_KEY in Vercel to enable)
  const serverKey = process.env.MCP_API_KEY;
  if (serverKey && req.headers.get("x-api-key") !== serverKey) {
    // Also allow the token itself as the x-api-key for simpler Claude Code configs
    if (req.headers.get("x-api-key") !== token) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Validate the user token
  const admin = getAdminClient();
  const { data: settings, error } = await admin
    .from("user_settings")
    .select("user_id")
    .eq("mcp_api_key", token)
    .single();

  if (error || !settings) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  const server = createServer();
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handleMcp(req, ctx);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handleMcp(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handleMcp(req, ctx);
}
