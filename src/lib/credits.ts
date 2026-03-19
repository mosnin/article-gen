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
  const profile = await getOrCreateProfile(supabase, userId);

  if (profile.role === "admin") {
    return { success: true, credits: -1 };
  }

  if (profile.credits < 1) {
    return { success: false, credits: 0 };
  }

  // Atomic decrement: only deducts if credits are still >= 1 at update time,
  // preventing race conditions where concurrent requests both pass the check above.
  const { data: updated, error: updateError } = await supabase
    .from("user_profiles")
    .update({ credits: profile.credits - 1, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("credits", profile.credits) // optimistic lock: fails if credits changed
    .select("credits")
    .single();

  if (updateError || !updated) {
    // Credits were modified concurrently — re-fetch and fail safely
    const { data: refetched } = await supabase
      .from("user_profiles")
      .select("credits")
      .eq("user_id", userId)
      .single();
    return { success: false, credits: refetched?.credits ?? 0 };
  }

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -1,
    type: "usage",
    description: description || "Article generation",
    article_id: articleId || null,
  });

  return { success: true, credits: updated.credits };
}
