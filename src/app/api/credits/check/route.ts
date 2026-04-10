import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkCredits } from "@/lib/credits";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await checkCredits(supabase, user.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("Unexpected error in credits/check", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
