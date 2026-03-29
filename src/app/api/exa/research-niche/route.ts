import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { researchNicheContent, findContentGaps } from "@/lib/exa";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { niche, competitors } = await req.json() as {
    niche: string;
    competitors?: string[];
  };

  if (!niche?.trim()) {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }

  try {
    const [trending, gaps] = await Promise.all([
      researchNicheContent(niche, { numResults: 20, competitors }),
      findContentGaps(niche, 15),
    ]);

    return NextResponse.json({ trending, gaps });
  } catch (err) {
    console.error("[exa/research-niche]", err);
    return NextResponse.json({ error: "Exa research failed" }, { status: 500 });
  }
}
