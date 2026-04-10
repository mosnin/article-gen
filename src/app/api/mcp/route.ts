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
  const server = new McpServer({
    name: "article-gen",
    version: "1.0.0",
  });

  registerSeoTools(server);
  registerAnalyticsTools(server);
  registerGenerationTools(server);
  registerAutopilotTools(server);

  return server;
}

async function handleMcp(req: NextRequest): Promise<Response> {
  // Try session auth first
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Fall back to API key auth
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = getAdminClient();
    const { data: settings, error } = await admin
      .from("user_settings")
      .select("user_id")
      .eq("mcp_api_key", apiKey)
      .single();

    if (error || !settings) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });

  const server = createServer();
  await server.connect(transport);

  return transport.handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleMcp(req);
}

export async function GET(req: NextRequest) {
  return handleMcp(req);
}

export async function DELETE(req: NextRequest) {
  return handleMcp(req);
}
