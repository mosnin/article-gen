import OpenAI from "openai";
import { createClient as createAdminClient } from "@/lib/supabase-admin";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Generate an embedding vector for a text string.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // token safety
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data[0].embedding;
}

/**
 * Generate an embedding for an article based on its title + keywords.
 * This compact representation is what we store and compare.
 */
export function buildArticleEmbeddingText(params: {
  title: string;
  keyword?: string;
  keywords?: string[];
  topic?: string;
}): string {
  const parts = [
    params.topic ?? params.title,
    params.title,
    params.keyword ?? "",
    ...(params.keywords ?? []),
  ].filter(Boolean);
  return parts.join(" | ");
}

/**
 * Store an article's embedding in the article_embeddings table.
 */
export async function storeArticleEmbedding(params: {
  userId: string;
  articleId?: string;
  autopilotSlotId?: string;
  title: string;
  keyword?: string;
  keywords?: string[];
  topic?: string;
}): Promise<void> {
  const text = buildArticleEmbeddingText(params);
  const embedding = await generateEmbedding(text);

  const supabase = createAdminClient();
  await supabase.from("article_embeddings").upsert(
    {
      user_id: params.userId,
      article_id: params.articleId ?? null,
      autopilot_slot_id: params.autopilotSlotId ?? null,
      title: params.title,
      keyword: params.keyword ?? null,
      embedding_text: text,
      embedding,
      created_at: new Date().toISOString(),
    },
    { onConflict: params.articleId ? "article_id" : "autopilot_slot_id" }
  );
}

/**
 * Check cosine similarity of a proposed topic against all existing
 * article embeddings for a user. Returns the most similar existing
 * content and a similarity score (0–1, higher = more similar).
 */
export async function checkTopicUniqueness(params: {
  userId: string;
  title: string;
  keyword?: string;
  topic?: string;
  threshold?: number;
}): Promise<{
  isUnique: boolean;
  similarityScore: number;
  mostSimilarTitle: string | null;
  mostSimilarKeyword: string | null;
}> {
  const threshold = params.threshold ?? 0.85;
  const text = buildArticleEmbeddingText(params);
  const embedding = await generateEmbedding(text);

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("match_article_embeddings", {
    query_embedding: embedding,
    match_user_id: params.userId,
    match_threshold: threshold,
    match_count: 1,
  });

  if (error) {
    console.error("[checkTopicUniqueness] RPC error", error);
    // Fail open — don't block generation if similarity check fails
    return { isUnique: true, similarityScore: 0, mostSimilarTitle: null, mostSimilarKeyword: null };
  }

  if (!data || data.length === 0) {
    return { isUnique: true, similarityScore: 0, mostSimilarTitle: null, mostSimilarKeyword: null };
  }

  const top = data[0];
  return {
    isUnique: false,
    similarityScore: top.similarity,
    mostSimilarTitle: top.title,
    mostSimilarKeyword: top.keyword,
  };
}

/**
 * Batch-check uniqueness for a list of proposed topics.
 * Returns each topic annotated with its uniqueness info.
 */
export async function batchCheckUniqueness(params: {
  userId: string;
  topics: Array<{ keyword: string; topic: string; contentType: string }>;
  threshold?: number;
}): Promise<Array<{
  keyword: string;
  topic: string;
  contentType: string;
  uniquenessScore: number; // 1 = fully unique, 0 = duplicate
  cannibalizesTitle: string | null;
  cannibalizesKeyword: string | null;
}>> {
  const results = await Promise.all(
    params.topics.map(async (t) => {
      const check = await checkTopicUniqueness({
        userId: params.userId,
        title: t.topic,
        keyword: t.keyword,
        topic: t.topic,
        threshold: params.threshold,
      });
      return {
        ...t,
        uniquenessScore: check.isUnique ? 1 : Math.max(0, 1 - check.similarityScore),
        cannibalizesTitle: check.isUnique ? null : check.mostSimilarTitle,
        cannibalizesKeyword: check.isUnique ? null : check.mostSimilarKeyword,
      };
    })
  );
  return results;
}
