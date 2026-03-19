import { SupabaseClient } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  user_id: string;
  role: "user" | "admin";
  credits: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan: "free" | "starter" | "growth" | "pro";
  subscription_status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOrCreateProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile> {
  const { data: existing } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) return existing as UserProfile;

  const { data: created, error } = await supabase
    .from("user_profiles")
    .insert({ user_id: userId })
    .select()
    .single();

  if (error) throw new Error("Failed to create user profile: " + error.message);
  return created as UserProfile;
}

export async function checkCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number = 1
): Promise<{ allowed: boolean; credits: number; isAdmin: boolean }> {
  const profile = await getOrCreateProfile(supabase, userId);

  if (profile.role === "admin") {
    return { allowed: true, credits: -1, isAdmin: true };
  }

  return {
    allowed: profile.credits >= amount,
    credits: profile.credits,
    isAdmin: false,
  };
}

export async function deductCredit(
  supabase: SupabaseClient,
  userId: string,
  articleId?: string,
  description?: string
): Promise<{ success: boolean; credits: number }> {
  // Admins have unlimited credits — bypass the DB function entirely.
  const profile = await getOrCreateProfile(supabase, userId);
  if (profile.role === "admin") {
    return { success: true, credits: -1 };
  }

  // Single round-trip atomic deduction via Postgres function.
  // The function updates credits WHERE credits >= 1, so concurrent requests
  // cannot both succeed — no optimistic-lock retry needed.
  const { data, error } = await supabase
    .rpc("deduct_credit_atomic", { p_user_id: userId })
    .single<{ success: boolean; credits: number }>();

  if (error || !data) {
    return { success: false, credits: profile.credits };
  }

  if (data.success) {
    await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: -1,
      type: "usage",
      description: description || "Article generation",
      article_id: articleId || null,
    });
  }

  return { success: data.success, credits: data.credits };
}
