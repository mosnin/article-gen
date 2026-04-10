import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { analyzeSERP } from "@/lib/serp-analyzer";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyword, numResults } = await req.json() as { keyword: string; numResults?: number };
  if (!keyword?.trim()) return NextResponse.json({ error: "keyword is required" }, { status: 400 });

  try {
    const analysis = await analyzeSERP(keyword.trim(), numResults ?? 10);
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[serp/analyze]", err);
    return NextResponse.json({ error: "SERP analysis failed" }, { status: 500 });
  }
}
