import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase-server";
import { inngest } from "@/lib/inngest";

export const runtime = "nodejs";

type PendingApproval = {
  id: string;
  user_id: string;
  schedule_id: string | null;
  topic_suggestion: string;
  focus_keyword: string | null;
  niche: string | null;
  tone: string | null;
  target_audience: string | null;
  platforms: Array<{ kind: string; id: string }> | null;
  proposed_run_at: string;
  status: "pending" | "approved" | "rejected";
  decided_at: string | null;
  dispatched_run_id: string | null;
  created_at: string;
};

export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from("autonomous_pending_approvals")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("status", "pending")
      .order("proposed_run_at", { ascending: false })
      .limit(100);

    if (error) {
      // Table may not exist yet (migration M1 still in flight) — surface empty
      // list to keep the UI functional.
      return NextResponse.json({ approvals: [] });
    }
    return NextResponse.json({ approvals: (data ?? []) as PendingApproval[] });
  } catch {
    return NextResponse.json({ approvals: [] });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: string; action?: "approve" | "reject" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ error: "id_and_action_required" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("autonomous_pending_approvals")
    .select("*")
    .eq("id", body.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const row = existing as PendingApproval;
  if (row.status !== "pending") {
    return NextResponse.json({ error: "already_decided" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();

  if (body.action === "reject") {
    const { error } = await supabase
      .from("autonomous_pending_approvals")
      .update({ status: "rejected", decided_at: nowIso })
      .eq("id", row.id)
      .eq("user_id", auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // approve
  const { error: updateError } = await supabase
    .from("autonomous_pending_approvals")
    .update({ status: "approved", decided_at: nowIso })
    .eq("id", row.id)
    .eq("user_id", auth.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const platforms = Array.isArray(row.platforms) ? row.platforms : [];

  try {
    await inngest.send({
      name: "agent/article.generate",
      data: {
        userId: row.user_id,
        kind: "autopilot",
        autopilotSlotId: null,
        topic: row.topic_suggestion,
        focusKeyword: row.focus_keyword ?? row.niche ?? row.topic_suggestion,
        tone: row.tone ?? undefined,
        targetAudience: row.target_audience ?? undefined,
        quality: "standard",
        options: {
          autoPublish: platforms.length > 0,
          platforms,
        },
      },
    });
  } catch (e) {
    // Approval was recorded but dispatch failed — revert status so the user can retry.
    await supabase
      .from("autonomous_pending_approvals")
      .update({ status: "pending", decided_at: null })
      .eq("id", row.id)
      .eq("user_id", auth.user.id);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "dispatch_failed" },
      { status: 500 },
    );
  }

  // Inngest `send` returns event ids rather than run ids; leave
  // `dispatched_run_id` NULL for the caller to reconcile later.
  return NextResponse.json({ ok: true });
}
