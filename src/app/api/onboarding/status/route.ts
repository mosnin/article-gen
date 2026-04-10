import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("onboarding_complete")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("Failed to fetch onboarding status", error, { userId: user.id, errorCode: error.code });
      return NextResponse.json({ error: "Failed to load onboarding status" }, { status: 500 });
    }

    // If profile doesn't exist yet, treat as onboarding not complete
    if (!profile) {
      return NextResponse.json({ onboarding_complete: false });
    }

    return NextResponse.json({
      onboarding_complete: profile.onboarding_complete ?? false,
    });
  } catch (error: unknown) {
    logger.error("Unexpected error in onboarding/status", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
