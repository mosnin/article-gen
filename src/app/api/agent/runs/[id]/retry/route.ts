import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminClient } from "@/lib/supabase-admin";
import { inngest } from "@/lib/inngest";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = getAdminClient();
  const { data: run } = await admin.from("agent_runs").select("*").eq("id", id).single();
  if (!run || run.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (run.status !== "failed") {
    return NextResponse.json(
      { error: "only failed runs can be retried" },
      { status: 409 },
    );
  }

  // Reuse the original input to dispatch a new run
  const input = (run.input ?? {}) as Record<string, unknown>;
  await inngest.send({
    name: "agent/article.generate",
    data: {
      ...input,
      userId: run.user_id as string,
      // attach a retry pointer for traceability
      retryOf: run.id as string,
    },
  });

  return NextResponse.json({ ok: true, retryOf: run.id });
}
