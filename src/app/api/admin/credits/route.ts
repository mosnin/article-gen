import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOrCreateProfile } from "@/lib/credits";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminProfile = await getOrCreateProfile(supabase, user.id);
    if (adminProfile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId, amount, description } = await req.json();

    if (!userId || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid userId or amount" }, { status: 400 });
    }

    // Get target user's current credits
    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("credits")
      .eq("user_id", userId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newCredits = targetProfile.credits + amount;

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: amount,
      type: "admin_grant",
      description: description || `Admin granted ${amount} credits`,
    });

    return NextResponse.json({ success: true, credits: newCredits });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
