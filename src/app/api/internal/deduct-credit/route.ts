import { NextResponse } from "next/server";
import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { deductCredit } from "@/lib/credits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { userId: string; articleId?: string; description?: string };
  try {
    body = JSON.parse(auth.rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.userId) {
    return NextResponse.json({ error: "userId_required" }, { status: 400 });
  }

  const admin = getAdminClient();
  const userId = body.userId;
  const articleId = body.articleId;

  // Idempotency: if a usage transaction already exists for this (user, article)
  // pair, return the current balance instead of double-charging. The unique
  // partial index on credit_transactions(user_id, article_id, type) added by
  // migration 20260425000000_audit_fixes.sql is the belt-and-braces guard.
  //
  // articleId is null for non-article-driven calls (e.g. ad-hoc tool tests):
  // there is no idempotency key available, so we accept the deduction.
  if (articleId) {
    const { data: existing } = await admin
      .from("credit_transactions")
      .select("amount, created_at")
      .eq("user_id", userId)
      .eq("article_id", articleId)
      .eq("type", "usage")
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { data: prof } = await admin
        .from("user_profiles")
        .select("credits, role")
        .eq("user_id", userId)
        .single();
      const credits = prof?.role === "admin" ? -1 : (prof?.credits ?? 0);
      return NextResponse.json({ success: true, credits, idempotent: true });
    }
  }

  try {
    const result = await deductCredit(
      admin,
      userId,
      articleId,
      body.description || "agent run",
    );
    if (!result.success) {
      return NextResponse.json(
        { error: "insufficient_credits", credits: result.credits },
        { status: 402 },
      );
    }
    return NextResponse.json({ success: true, credits: result.credits });
  } catch (e) {
    return NextResponse.json(
      { error: "deduct_failed", detail: String(e) },
      { status: 500 },
    );
  }
}
