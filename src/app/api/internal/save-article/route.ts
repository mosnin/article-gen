import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { upsertVector, userNamespace } from "@/lib/upstash-vector";
import OpenAI from "openai";

export const runtime = "nodejs";

type SaveBody = {
  userId: string;
  runId: string;
  title: string;
  slug: string;
  metaDescription: string;
  focusKeyword: string;
  keywords: string[];
  topic: string;
  tone?: string;
  targetAudience?: string;
  quality?: string;
  articleMarkdown: string;
  schemaJson?: string;
  imagePrompts?: Array<{ type: string; prompt: string; altText: string }>;
  generatedImages?: Array<{
    type: string;
    altText: string;
    storagePath: string;
    publicUrl: string;
    success?: boolean;
  }>;
  outlineHeadings?: string[];
  clusterId?: string;
};

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: SaveBody;
  try {
    body = JSON.parse(auth.rawBody) as SaveBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.userId || !body.title || !body.slug || !body.articleMarkdown) {
    return Response.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("articles")
    .insert({
      user_id: body.userId,
      topic: body.topic,
      focus_keyword: body.focusKeyword,
      quality: body.quality || "standard",
      title: body.title,
      meta_description: body.metaDescription,
      slug: body.slug,
      keywords: body.keywords,
      article_markdown: body.articleMarkdown,
      image_prompts: body.imagePrompts ?? [],
      generated_images: body.generatedImages ?? [],
      schema_json: body.schemaJson ?? null,
      cluster_id: body.clusterId ?? null,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    return Response.json(
      { error: "insert_failed", detail: error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  // best-effort Upstash upsert — do NOT fail the save if this errors
  if (body.outlineHeadings && body.outlineHeadings.length > 0) {
    try {
      const embedInput = [
        body.title,
        body.focusKeyword,
        body.topic,
        (body.outlineHeadings || []).join(" | "),
      ].join("\n");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const emb = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: embedInput,
      });
      const vector = emb.data[0].embedding;
      await upsertVector(userNamespace(body.userId), {
        id: `article:${data.id}`,
        vector,
        metadata: {
          userId: body.userId,
          articleId: data.id,
          runId: body.runId,
          title: body.title,
          keyword: body.focusKeyword,
          topic: body.topic,
          outlineHeadings: body.outlineHeadings,
          createdAt: new Date().toISOString(),
          clusterId: body.clusterId ?? null,
        },
      });
    } catch (e) {
      // log only; article is still saved
      console.error("upstash upsert failed", e);
    }
  }

  return Response.json({ articleId: data.id, slug: data.slug });
}
