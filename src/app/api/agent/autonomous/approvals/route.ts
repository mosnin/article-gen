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

type Action = "approve" | "reject";

type SingleBody = { id: string; action: Action };
type BulkBody = { ids: string[]; action: Action };
type IncomingBody = Partial<SingleBody> & Partial<BulkBody>;

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>;

type ProcessOutcome =
  | { id: string; ok: true }
  | { id: string; ok: false; error: string };

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

async function processOne(
  supabase: SupabaseServer,
  userId: string,
  id: string,
  action: Action,
): Promise<ProcessOutcome> {
  const { data: existing, error: fetchError } = await supabase
    .from("autonomous_pending_approvals")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { id, ok: false, error: "not_found" };
  }

  const row = existing as PendingApproval;
  if (row.status !== "pending") {
    return { id, ok: false, error: "already_decided" };
  }

  const nowIso = new Date().toISOString();

  if (action === "reject") {
    const { error } = await supabase
      .from("autonomous_pending_approvals")
      .update({ status: "rejected", decided_at: nowIso })
      .eq("id", row.id)
      .eq("user_id", userId);
    if (error) return { id, ok: false, error: error.message };
    return { id, ok: true };
  }

  // approve
  const { error: updateError } = await supabase
    .from("autonomous_pending_approvals")
    .update({ status: "approved", decided_at: nowIso })
    .eq("id", row.id)
    .eq("user_id", userId);

  if (updateError) {
    return { id, ok: false, error: updateError.message };
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
      .eq("user_id", userId);
    return {
      id,
      ok: false,
      error: e instanceof Error ? e.message : "dispatch_failed",
    };
  }

  // Inngest `send` returns event ids rather than run ids; leave
  // `dispatched_run_id` NULL for the caller to reconcile later.
  return { id, ok: true };
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "id_and_action_required" }, { status: 400 });
  }
  const action: Action = body.action;

  // Bulk path
  if (Array.isArray(body.ids)) {
    const ids = body.ids.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids_required" }, { status: 400 });
    }

    const results: ProcessOutcome[] = [];
    for (const id of ids) {
      // Sequential processing — for approve we need per-id inngest dispatch;
      // for reject we still process serially to keep error reporting clean.
      results.push(await processOne(supabase, auth.user.id, id, action));
    }

    const succeeded = results.filter((r) => r.ok).map((r) => r.id);
    const failed = results.filter((r): r is Extract<ProcessOutcome, { ok: false }> => !r.ok);

    return NextResponse.json({
      ok: failed.length === 0,
      succeeded,
      failed,
    });
  }

  // Single-id path (existing behavior)
  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id_and_action_required" }, { status: 400 });
  }

  const result = await processOne(supabase, auth.user.id, body.id, action);
  if (!result.ok) {
    const status =
      result.error === "not_found" ? 404 :
      result.error === "already_decided" ? 409 :
      500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
