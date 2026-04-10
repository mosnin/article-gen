import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOrCreateProfile } from "@/lib/credits";
import { logger } from "@/lib/logger";

const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  free: 10,
  starter: 50,
  growth: 150,
  pro: 300,
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getOrCreateProfile(supabase, user.id);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Query credit_transactions for usage in the last 30 days
    const { data: transactions, error: txError } = await supabase
      .from("credit_transactions")
      .select("amount, created_at")
      .eq("user_id", user.id)
      .eq("type", "usage")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false });

    if (txError) {
      logger.error("Failed to query credit transactions", txError, {
        userId: user.id,
        endpoint: "/api/credits/usage",
      });
      return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
    }

    const rows = transactions ?? [];

    // Usage amounts are stored as negative numbers (deductions)
    const usedLast30Days = rows.reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0
    );

    const usedLast7Days = rows
      .filter((tx) => tx.created_at >= sevenDaysAgo)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const dailyBurnRate = usedLast30Days / 30;

    const balance = profile.credits;
    const plan = profile.subscription_plan;
    const monthlyAllocation = PLAN_MONTHLY_CREDITS[plan] ?? 10;
    const isAdmin = profile.role === "admin";

    const estimatedDaysRemaining =
      isAdmin || dailyBurnRate === 0
        ? null
        : Math.floor(balance / dailyBurnRate);

    return NextResponse.json({
      balance,
      usedLast7Days,
      usedLast30Days,
      dailyBurnRate: Math.round(dailyBurnRate * 10) / 10,
      estimatedDaysRemaining,
      plan,
      monthlyAllocation,
      isAdmin,
    });
  } catch (error: unknown) {
    logger.error("Unexpected error in credits usage route", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
