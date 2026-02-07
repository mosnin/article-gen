import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { deductCredit } from "@/lib/credits";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, description } = await req.json();

    const result = await deductCredit(supabase, user.id, articleId, description);

    if (!result.success) {
      return NextResponse.json(
        { error: "Insufficient credits", credits: result.credits },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, credits: result.credits });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
