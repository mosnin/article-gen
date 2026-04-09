import { inngest } from "@/lib/inngest";
import { generateEmbedding, buildArticleEmbeddingText, storeArticleEmbedding } from "@/lib/embeddings";

export const embedArticle = inngest.createFunction(
  { id: "embed-article", name: "Store Article Embedding", retries: 2 },
  { event: "article/embedding.store" },
  async ({ event }) => {
    const { userId, articleId, title, keyword, content } = event.data;
    const embeddingText = buildArticleEmbeddingText({ title, keyword, content: content.slice(0, 2000) });
    const embedding = await generateEmbedding(embeddingText);
    await storeArticleEmbedding({ userId, articleId, title, keyword, embeddingText, embedding });
    return { success: true };
  }
);
