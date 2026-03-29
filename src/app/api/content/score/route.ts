import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { scoreContent } from "@/lib/nlp-scorer";
import { analyzeSERP } from "@/lib/serp-analyzer";

export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, keyword, nlpTerms, questionsToAnswer, recommendedWordCount } = await req.json() as {
    content: string;
    keyword: string;
    nlpTerms?: string[];
    questionsToAnswer?: string[];
    recommendedWordCount?: number;
  };

  if (!content?.trim() || !keyword?.trim()) {
    return NextResponse.json({ error: "content and keyword are required" }, { status: 400 });
  }

  // If NLP terms not provided, run SERP analysis to get them
  let terms = nlpTerms ?? [];
  let questions = questionsToAnswer ?? [];
  let recWordCount = recommendedWordCount ?? 1500;

  if (!nlpTerms?.length) {
    try {
      const serp = await analyzeSERP(keyword, 6);
      terms = serp.commonTopics;
      questions = serp.questionsAnswered;
      recWordCount = serp.recommendedWordCount;
    } catch {
      // proceed with empty terms
    }
  }

  const score = scoreContent({
    content,
    nlpTerms: terms,
    questionsToAnswer: questions,
    recommendedWordCount: recWordCount,
  });

  return NextResponse.json(score);
}
