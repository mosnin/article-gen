import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { inngest } from "@/lib/inngest";

export const runtime = "nodejs";

type RefreshBody = {
  articleId?: string;
};

type ArticleRow = {
  id: string;
  user_id: string;
  topic: string | null;
  focus_keyword: string | null;
  tone: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RefreshBody;
  try {
    body = (await req.json()) as RefreshBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const articleId = body.articleId?.trim();
  if (!articleId) {
    return NextResponse.json(
      { error: "articleId is required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("articles")
    .select("id, user_id, topic, focus_keyword, tone")
    .eq("id", articleId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const row = data as ArticleRow | null;
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const focusKeyword = row.focus_keyword ?? row.topic ?? "";
  const topic = row.topic ?? focusKeyword;

  await inngest.send({
    name: "agent/article.generate",
    data: {
      userId: user.id,
      kind: "refresh",
      articleId,
      topic,
      focusKeyword,
      tone: row.tone ?? "professional",
      targetAudience: null,
    },
  });

  return NextResponse.json({ dispatched: true, articleId });
}
