import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkCredits } from "@/lib/credits";
import { requireUser } from "@/lib/api-auth";

export async function GET() {
  try {
    const supabase = await createClient();
    const authResult = await requireUser(supabase);
    if ("response" in authResult) return authResult.response;
    const { user } = authResult;

    const result = await checkCredits(supabase, user.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
