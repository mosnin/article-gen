import { inngest } from "@/lib/inngest";

export async function triggerEmbedArticle(data: {
  userId: string;
  articleId: string;
  title: string;
  keyword: string;
  content: string;
}) {
  try {
    await inngest.send({ name: "article/embedding.store", data });
  } catch {
    // fail silently — embedding is non-critical
  }
}

export async function triggerAutopilotArticle(data: {
  userId: string;
  slotId: string;
  keyword: string;
  topic: string;
  contentType: string;
}) {
  await inngest.send({ name: "autopilot/article.generate", data });
}

export async function triggerArticlePublished(data: {
  userId: string;
  articleId: string;
  platform: string;
  postUrl: string;
}) {
  try {
    await inngest.send({ name: "article/published", data });
  } catch { /* non-critical */ }
}
