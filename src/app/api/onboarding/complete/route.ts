import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ onboarding_complete: true })
      .eq("user_id", user.id);

    if (error) {
      logger.error("Failed to complete onboarding", error, { userId: user.id, errorCode: error.code });
      return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("Unexpected error in onboarding/complete", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
