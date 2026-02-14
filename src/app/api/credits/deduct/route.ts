import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { deductCredit } from "@/lib/credits";
import { requireUser } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const DeductSchema = z.object({
  articleId: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await requireUser(supabase);
    if ("response" in authResult) return authResult.response;
    const { user } = authResult;

    const parsed = await parseJsonBody(req, DeductSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { articleId, description } = parsed;

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
