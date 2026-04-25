import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient as createSupabaseServer } from "@/lib/supabase-server";
import { cancelAgentRun } from "@/lib/agent-runs";
import { getAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = getAdminClient();

  const { data: run } = await admin
    .from("agent_runs")
    .select("modal_call_id, user_id, status")
    .eq("id", id)
    .single();
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (run.user_id !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!["pending", "running"].includes(run.status)) {
    return NextResponse.json({ error: "not_cancellable", status: run.status }, { status: 409 });
  }

  // Best-effort: tell Modal to cancel the FunctionCall before flipping the DB
  // status. If Modal's cancel endpoint is unreachable we still flip the DB so
  // the user's slot is freed; the late `succeeded` event from Modal is then
  // ignored by the webhook (terminal-state guard).
  const cancelUrl = process.env.MODAL_AGENT_CANCEL_URL;
  const token = process.env.MODAL_AGENT_TOKEN;
  if (run.modal_call_id && cancelUrl && token) {
    const body = JSON.stringify({ modalCallId: run.modal_call_id });
    const sig =
      "sha256=" + crypto.createHmac("sha256", token).update(body).digest("hex");
    await fetch(cancelUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": sig },
      body,
    }).catch((err) => {
      logger.error("[cancel] modal cancel POST failed", err);
    });
  }

  await cancelAgentRun(id);
  return NextResponse.json({ ok: true });
}
