import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAgentRun, listAgentEvents } from "@/lib/agent-runs";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Run ID is required" }, { status: 400 });
  }

  try {
    const run = await getAgentRun(id);
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (run.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const events = await listAgentEvents(id, 200);
    return NextResponse.json({ run, events });
  } catch (error: unknown) {
    logger.error("Failed to fetch agent run", error);
    return NextResponse.json({ error: "Failed to query run" }, { status: 500 });
  }
}
