import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminClient } from "@/lib/supabase-admin";
import { registerGenerationTools } from "./generation-tools";
import { registerSeoTools } from "./seo-tools";
import { registerAnalyticsTools } from "./analytics-tools";
import { registerAutopilotTools } from "./autopilot-tools";

export const maxDuration = 60;

function createServer(): McpServer {
  const server = new McpServer({ name: "article-gen", version: "1.0.0" });
  registerSeoTools(server);
  registerAnalyticsTools(server);
  registerGenerationTools(server);
  registerAutopilotTools(server);
  return server;
}

async function resolveUser(req: NextRequest): Promise<string | null> {
  // 1. Authorization: Bearer <token>  (Claude Code / external clients)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const admin = getAdminClient();
    const { data } = await admin
      .from("user_settings")
      .select("user_id")
      .eq("mcp_api_key", token)
      .single();
    if (data?.user_id) return data.user_id;
  }

  // 2. Supabase session cookie (browser / dashboard use)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;

  return null;
}

async function handleMcp(req: NextRequest): Promise<Response> {
  const userId = await resolveUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = createServer();
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: NextRequest) { return handleMcp(req); }
export async function GET(req: NextRequest) { return handleMcp(req); }
export async function DELETE(req: NextRequest) { return handleMcp(req); }
