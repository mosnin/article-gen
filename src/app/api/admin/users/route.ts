import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminResult = await requireAdmin(supabase);
    if ("response" in adminResult) return adminResult.response;

    // Fetch all user profiles
    const { data: profiles, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // For each profile, get article count and recent transactions
    const enrichedProfiles = await Promise.all(
      (profiles || []).map(async (p) => {
        const { count: articleCount } = await supabase
          .from("articles")
          .select("*", { count: "exact", head: true })
          .eq("user_id", p.user_id);

        const { data: transactions } = await supabase
          .from("credit_transactions")
          .select("*")
          .eq("user_id", p.user_id)
          .order("created_at", { ascending: false })
          .limit(10);

        return {
          ...p,
          article_count: articleCount || 0,
          recent_transactions: transactions || [],
        };
      })
    );

    return NextResponse.json({ users: enrichedProfiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
