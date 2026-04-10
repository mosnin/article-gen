import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOrCreateProfile } from "@/lib/credits";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getOrCreateProfile(supabase, user.id);

    return NextResponse.json({
      credits: profile.credits,
      plan: profile.subscription_plan,
      role: profile.role,
      isAdmin: profile.role === "admin",
    });
  } catch (error: unknown) {
    logger.error("Unexpected error in credits route", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
