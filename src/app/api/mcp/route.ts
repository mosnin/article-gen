import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";

// API key auth — set MCP_API_KEY env var
function authenticate(req: NextRequest): string | null {
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  return apiKey === process.env.MCP_API_KEY ? "authenticated" : null;
}

const server = new McpServer({ name: "article-gen", version: "1.0.0" });

// Tool: list_articles
server.tool("list_articles", "List recent articles for a user",
  { user_id: z.string(), limit: z.number().default(20), status: z.string().optional() },
  async ({ user_id, limit, status }) => {
    const supabase = getAdminClient();
    let q = supabase.from("articles").select("id, title, focus_keyword, status, word_count, created_at").eq("user_id", user_id).order("created_at", { ascending: false }).limit(limit);
    if (status) q = q.eq("status", status);
    const { data } = await q;
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }] };
  }
);

// Tool: get_article
server.tool("get_article", "Get full article content by ID",
  { article_id: z.string() },
  async ({ article_id }) => {
    const supabase = getAdminClient();
    const { data } = await supabase.from("articles").select("*").eq("id", article_id).single();
    return { content: [{ type: "text", text: JSON.stringify(data ?? {}) }] };
  }
);

// Tool: search_articles
server.tool("search_articles", "Search articles by keyword or title",
  { user_id: z.string(), query: z.string() },
  async ({ user_id, query }) => {
    const supabase = getAdminClient();
    const { data } = await supabase.from("articles").select("id, title, focus_keyword, status, word_count").eq("user_id", user_id).or(`title.ilike.%${query}%,focus_keyword.ilike.%${query}%`).limit(10);
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }] };
  }
);

// Tool: update_article_status
server.tool("update_article_status", "Update article status (draft/published)",
  { article_id: z.string(), status: z.enum(["draft", "published"]) },
  async ({ article_id, status }) => {
    const supabase = getAdminClient();
    await supabase.from("articles").update({ status }).eq("id", article_id);
    return { content: [{ type: "text", text: `Article ${article_id} status updated to ${status}` }] };
  }
);

export async function POST(req: NextRequest) {
  if (!authenticate(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  await server.connect(transport);
  const body = await req.json();
  const response = await transport.handleRequest(body, Object.fromEntries(req.headers));
  return NextResponse.json(response);
}

export async function GET() {
  return NextResponse.json({
    name: "article-gen MCP server",
    version: "1.0.0",
    tools: ["list_articles", "get_article", "search_articles", "update_article_status"],
  });
}
