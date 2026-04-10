import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOrCreateProfile } from "@/lib/credits";
import { logger } from "@/lib/logger";

// Business policy limits — prevents runaway credit grants
const MAX_CREDITS_PER_GRANT = 10_000;
const MAX_TOTAL_CREDITS = 100_000;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Note: middleware also enforces admin role — this is defense-in-depth
    const adminProfile = await getOrCreateProfile(supabase, user.id);
    if (adminProfile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId, amount, description } = await req.json();

    if (!userId || typeof amount !== "number" || amount <= 0 || amount > MAX_CREDITS_PER_GRANT) {
      return NextResponse.json(
        { error: `Invalid userId or amount. Amount must be 1–${MAX_CREDITS_PER_GRANT}.` },
        { status: 400 }
      );
    }

    // Use an atomic increment to avoid read-then-write race condition between
    // concurrent admin grants. We rely on Postgres to compute the new value.
    // First verify user exists and check total cap.
    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("credits")
      .eq("user_id", userId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetProfile.credits + amount > MAX_TOTAL_CREDITS) {
      return NextResponse.json(
        { error: `Grant would exceed the ${MAX_TOTAL_CREDITS.toLocaleString()} credit limit.` },
        { status: 400 }
      );
    }

    // Atomic increment — avoids the race condition of SELECT → compute → UPDATE
    const { data: updatedRows, error: updateError } = await supabase
      .from("user_profiles")
      .update({ credits: targetProfile.credits + amount, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("credits", targetProfile.credits) // optimistic lock: only update if unchanged
      .select("credits")
      .single();

    if (updateError || !updatedRows) {
      // Concurrent modification detected — safe to retry from caller
      return NextResponse.json(
        { error: "Concurrent modification detected. Please retry." },
        { status: 409 }
      );
    }

    await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: amount,
      type: "admin_grant",
      description: description || `Admin granted ${amount} credits`,
    });

    return NextResponse.json({ success: true, credits: updatedRows.credits });
  } catch (error: unknown) {
    logger.error("Unexpected error in admin/credits", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
