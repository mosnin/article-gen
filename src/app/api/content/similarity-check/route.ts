import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkTopicUniqueness, batchCheckUniqueness } from "@/lib/embeddings";

export const maxDuration = 30;

/**
 * POST /api/content/similarity-check
 *
 * Check if a proposed topic (or batch of topics) would cannibalize
 * existing content for the authenticated user.
 *
 * Body (single):
 *   { title: string; keyword?: string; topic?: string; threshold?: number }
 *
 * Body (batch):
 *   { topics: Array<{ keyword: string; topic: string; contentType: string }>; threshold?: number }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    // Single check
    title?: string;
    keyword?: string;
    topic?: string;
    threshold?: number;
    // Batch check
    topics?: Array<{ keyword: string; topic: string; contentType: string }>;
  };

  if (body.topics && Array.isArray(body.topics)) {
    // Batch mode
    const results = await batchCheckUniqueness({
      userId: user.id,
      topics: body.topics,
      threshold: body.threshold,
    });
    return NextResponse.json({ results });
  }

  if (body.title || body.topic) {
    // Single mode
    const result = await checkTopicUniqueness({
      userId: user.id,
      title: body.title ?? body.topic ?? "",
      keyword: body.keyword,
      topic: body.topic,
      threshold: body.threshold,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: "Provide either title/topic or a topics array" },
    { status: 400 }
  );
}
