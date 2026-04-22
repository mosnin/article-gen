import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase-server";
import { getAgentRun, cancelAgentRun } from "@/lib/agent-runs";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const run = await getAgentRun(id);
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (run.user_id !== auth.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!["pending", "running"].includes(run.status)) {
    return NextResponse.json({ error: "not_cancellable", status: run.status }, { status: 409 });
  }

  await cancelAgentRun(id);
  return NextResponse.json({ ok: true });
}
