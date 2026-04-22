import { requireInternalAuth } from "@/lib/agent-auth";
import { queryVector, userNamespace } from "@/lib/upstash-vector";
import OpenAI from "openai";

export const runtime = "nodejs";

type SimilarArticle = {
  articleId: string;
  title: string;
  keyword: string;
  score: number;
  createdAt: string;
};

type CheckBody = {
  userId: string;
  topic: string;
  keyword?: string;
  k?: number;
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

  let body: CheckBody;
  try {
    body = JSON.parse(auth.rawBody) as CheckBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.userId || !body.topic) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const k = Math.min(20, Math.max(1, body.k ?? 5));
  const query = `${body.topic}\n${body.keyword ?? ""}`;

  try {
    const vector = await embed(query);
    const matches = await queryVector(
      userNamespace(body.userId),
      vector,
      k,
      true,
    );
    const similar: SimilarArticle[] = matches.map((m) => {
      const meta = (m.metadata ?? {}) as Record<string, unknown>;
      return {
        articleId: String(meta.articleId ?? m.id.replace(/^article:/, "")),
        title: String(meta.title ?? ""),
        keyword: String(meta.keyword ?? ""),
        score: m.score,
        createdAt: String(meta.createdAt ?? ""),
      };
    });
    return Response.json({ similar });
  } catch (e) {
    // upstash not configured / network error -> return empty (dedup is best-effort)
    console.error("check-uniqueness failed", e);
    return Response.json({ similar: [] as SimilarArticle[] });
  }
}
