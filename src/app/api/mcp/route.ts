import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { registerGenerationTools } from "./generation-tools";
import { registerSeoTools } from "./seo-tools";
import { registerAnalyticsTools } from "./analytics-tools";

export const maxDuration = 60;

function createServer(): McpServer {
  const server = new McpServer({
    name: "article-gen",
    version: "1.0.0",
  });

  registerSeoTools(server);
  registerAnalyticsTools(server);
  registerGenerationTools(server);

  return server;
}

async function handleMcp(req: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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
