import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const AdminCreditGrantSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  amount: z.number().positive("amount must be greater than 0"),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminResult = await requireAdmin(supabase);
    if ("response" in adminResult) return adminResult.response;

    const parsed = await parseJsonBody(req, AdminCreditGrantSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { userId, amount, description } = parsed;

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
      performed_by: adminResult.user.id,
      source: "admin_api",
      request_id: req.headers.get("x-request-id") || null,
    });

    return NextResponse.json({ success: true, credits: newCredits });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
