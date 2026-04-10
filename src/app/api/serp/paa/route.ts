import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getExa } from "@/lib/exa";

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyword } = await req.json() as { keyword: string };
  if (!keyword?.trim()) return NextResponse.json({ error: "keyword is required" }, { status: 400 });

  try {
    const exa = getExa();
    // Search for question-style content around the keyword
    const [qa, howto] = await Promise.all([
      exa.search(`${keyword} questions answers FAQ`, { numResults: 8, type: "keyword" }),
      exa.search(`how to ${keyword} why when what`, { numResults: 8, type: "neural" }),
    ]);

    const allResults = [...(qa.results ?? []), ...(howto.results ?? [])];
    const questions = new Set<string>();

    for (const r of allResults) {
      // Extract question-like titles
      if (r.title && (r.title.includes("?") || /^(how|what|why|when|where|is|are|can|does|do|will)\s/i.test(r.title))) {
        questions.add(r.title.trim());
      }
    }

    return NextResponse.json({
      keyword,
      questions: [...questions].slice(0, 15),
    });
  } catch (err) {
    console.error("[serp/paa]", err);
    return NextResponse.json({ error: "PAA extraction failed" }, { status: 500 });
  }
}
