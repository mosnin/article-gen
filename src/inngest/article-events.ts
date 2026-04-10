import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

export const onArticlePublished = inngest.createFunction(
  { id: "on-article-published" },
  { event: "article/published" },
  async ({ event }) => {
    const { articleId, userId, platform, accountName, postUrl, editUrl, postId } = event.data as {
      articleId: string;
      userId: string;
      platform: string;
      accountName?: string;
      postUrl?: string;
      editUrl?: string;
      postId?: string;
    };

    const supabase = getAdminClient();

    // Check if already logged for this article + platform combination
    const { data: existing } = await supabase
      .from("publish_logs")
      .select("id")
      .eq("article_id", articleId)
      .eq("platform", platform)
      .maybeSingle();

    if (existing) {
      return { skipped: true, reason: "Already logged" };
    }

    // Insert publish log
    const { error } = await supabase.from("publish_logs").insert({
      user_id: userId,
      article_id: articleId,
      platform,
      account_name: accountName ?? null,
      post_url: postUrl ?? null,
      edit_url: editUrl ?? null,
      post_id: postId ?? null,
    });

    if (error) {
      throw new Error(`Failed to insert publish log: ${error.message}`);
    }

    return { logged: true, articleId, platform };
  }
);

export const weeklyContentReport = inngest.createFunction(
  { id: "weekly-content-report" },
  { cron: "0 9 * * 1" },
  async ({ step }) => {
    const result = await step.run("generate-weekly-reports", async () => {
      const supabase = getAdminClient();

      const now = new Date();
      // Week start is this Monday at 00:00 UTC
      const weekStart = new Date(now);
      weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay() + 1); // Monday
      weekStart.setUTCHours(0, 0, 0, 0);
      const weekStartDate = weekStart.toISOString().split("T")[0];

      // 7 days ago
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);
      sevenDaysAgo.setUTCHours(0, 0, 0, 0);

      // Fetch all articles created in the past 7 days
      const { data: articles, error: articlesError } = await supabase
        .from("articles")
        .select("id, user_id, status, word_count, created_at")
        .gte("created_at", sevenDaysAgo.toISOString());

      if (articlesError) {
        throw new Error(`Failed to fetch articles: ${articlesError.message}`);
      }

      if (!articles?.length) {
        return { reportsGenerated: 0 };
      }

      // Group by user_id
      const byUser = new Map<
        string,
        { generated: number; published: number; totalWords: number }
      >();

      for (const article of articles) {
        const uid = article.user_id as string;
        if (!byUser.has(uid)) {
          byUser.set(uid, { generated: 0, published: 0, totalWords: 0 });
        }
        const stats = byUser.get(uid)!;
        stats.generated += 1;
        if (article.status === "published") {
          stats.published += 1;
        }
        stats.totalWords += (article.word_count as number) ?? 0;
      }

      // Upsert one row per user into content_reports
      let reportsGenerated = 0;
      for (const [userId, stats] of byUser.entries()) {
        const { error: upsertError } = await supabase
          .from("content_reports")
          .upsert(
            {
              user_id: userId,
              week_start: weekStartDate,
              articles_generated: stats.generated,
              articles_published: stats.published,
              total_words: stats.totalWords,
            },
            { onConflict: "user_id,week_start" }
          );

        if (upsertError) {
          throw new Error(
            `Failed to upsert content report for user ${userId}: ${upsertError.message}`
          );
        }
        reportsGenerated++;
      }

      return { reportsGenerated, weekStart: weekStartDate };
    });

    return result;
  }
);
