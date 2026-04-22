import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { listAgentRuns } from "@/lib/agent-runs";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Math.min(200, Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50);

  try {
    const runs = await listAgentRuns(user.id, limit);
    return NextResponse.json({ runs });
  } catch (error: unknown) {
    logger.error("Failed to list agent runs", error);
    return NextResponse.json({ error: "Failed to query runs" }, { status: 500 });
  }
}
