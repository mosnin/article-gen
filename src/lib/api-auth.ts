import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getOrCreateProfile } from "@/lib/credits";

export async function requireUser(
  supabase: SupabaseClient
): Promise<{ user: User } | { response: NextResponse }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user };
}

export async function requireAdmin(
  supabase: SupabaseClient
): Promise<{ user: User } | { response: NextResponse }> {
  const authResult = await requireUser(supabase);
  if ("response" in authResult) return authResult;

  const profile = await getOrCreateProfile(supabase, authResult.user.id);
  if (profile.role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: authResult.user };
}
