import { requireInternalAuth } from "@/lib/agent-auth";
import { upsertVector, userNamespace } from "@/lib/upstash-vector";
import OpenAI from "openai";

export const runtime = "nodejs";

type UpsertBody = {
  userId: string;
  articleId: string;
  title: string;
  keyword: string;
  topic: string;
  outline?: string[];
};

async function embed(text: string): Promise<number[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return resp.data[0].embedding;
}

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: UpsertBody;
  try {
    body = JSON.parse(auth.rawBody) as UpsertBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.userId || !body.articleId || !body.title) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const embedInput = [
    body.title,
    body.keyword,
    body.topic,
    (body.outline ?? []).join(" | "),
  ].join("\n");

  try {
    const vector = await embed(embedInput);
    await upsertVector(userNamespace(body.userId), {
      id: `article:${body.articleId}`,
      vector,
      metadata: {
        userId: body.userId,
        articleId: body.articleId,
        title: body.title,
        keyword: body.keyword,
        topic: body.topic,
        outlineHeadings: body.outline ?? [],
        createdAt: new Date().toISOString(),
      },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: "upsert_failed", detail: String(e) },
      { status: 502 },
    );
  }
}
