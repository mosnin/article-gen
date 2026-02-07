import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOrCreateProfile } from "@/lib/credits";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getOrCreateProfile(supabase, user.id);
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
