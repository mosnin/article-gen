import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { estimateKeywordDifficulty } from "@/lib/keyword-difficulty";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyword } = await req.json() as { keyword: string };
  if (!keyword?.trim()) return NextResponse.json({ error: "keyword required" }, { status: 400 });

  const result = await estimateKeywordDifficulty(keyword);
  return NextResponse.json(result);
}
