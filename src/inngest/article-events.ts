import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

export const onArticlePublished = inngest.createFunction(
  { id: "on-article-published" },
  { event: "article/published" },
  async ({ event }) => {
    const { articleId, userId, platform } = event.data as {
      articleId: string;
      userId: string;
      platform: string;
    };

    const supabase = getAdminClient();

    // Check if this publish event is already logged
    const { data: existing } = await supabase
      .from("publish_logs")
      .select("id")
      .eq("article_id", articleId)
      .eq("user_id", userId)
      .eq("platform", platform)
      .maybeSingle();

    if (existing) {
      console.log(
        `[on-article-published] Already logged: article=${articleId} platform=${platform}`
      );
      return { skipped: true };
    }

    const { error } = await supabase.from("publish_logs").insert({
      article_id: articleId,
      user_id: userId,
      platform,
      account_name: (event.data as Record<string, string>).accountName ?? null,
      post_id: (event.data as Record<string, string>).postId
        ? String((event.data as Record<string, string>).postId)
        : null,
      post_url: (event.data as Record<string, string>).postUrl ?? null,
      edit_url: (event.data as Record<string, string>).editUrl ?? null,
    });

    if (error) {
      console.error("[on-article-published] Failed to insert publish log:", error.message);
      throw new Error(`Failed to log publish event: ${error.message}`);
    }

    console.log(
      `[on-article-published] Logged publish event: article=${articleId} platform=${platform}`
    );
    return { logged: true };
  }
);

export const weeklyContentReport = inngest.createFunction(
  { id: "weekly-content-report" },
  { cron: "0 9 * * 1" },
  async ({ step }) => {
    const supabase = getAdminClient();

    const weekStart = await step.run("compute-week-start", async () => {
      const now = new Date();
      // Monday of the current week (9am trigger day)
      const day = now.getDay(); // 0=Sun, 1=Mon
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      return monday.toISOString().slice(0, 10); // YYYY-MM-DD
    });

    const sevenDaysAgo = await step.run("compute-range-start", async () => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    });

    const weekStartIso = new Date(weekStart).toISOString();

    // Fetch all articles created in the past 7 days
    const articles = await step.run("fetch-articles", async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, user_id, status, word_count, created_at")
        .gte("created_at", sevenDaysAgo)
        .lt("created_at", weekStartIso);

      if (error) {
        throw new Error(`Failed to fetch articles: ${error.message}`);
      }
      return data ?? [];
    });

    // Aggregate stats per user
    const statsMap = await step.run("aggregate-stats", async () => {
      const map: Record<
        string,
        { generated: number; published: number; totalWords: number }
      > = {};

      for (const article of articles) {
        const uid = article.user_id as string;
        if (!map[uid]) {
          map[uid] = { generated: 0, published: 0, totalWords: 0 };
        }
        map[uid].generated += 1;
        if (article.status === "published") {
          map[uid].published += 1;
        }
        map[uid].totalWords += (article.word_count as number) ?? 0;
      }

      return map;
    });

    // Upsert one content_reports row per user
    const upsertResults = await step.run("upsert-reports", async () => {
      const rows = Object.entries(statsMap).map(([userId, stats]) => ({
        user_id: userId,
        week_start: weekStart,
        articles_generated: stats.generated,
        articles_published: stats.published,
        total_words: stats.totalWords,
      }));

      if (rows.length === 0) {
        return { upserted: 0 };
      }

      const { error } = await supabase
        .from("content_reports")
        .upsert(rows, { onConflict: "user_id,week_start" });

      if (error) {
        throw new Error(`Failed to upsert content reports: ${error.message}`);
      }

      return { upserted: rows.length };
    });

    console.log(
      `[weekly-content-report] week_start=${weekStart} users=${Object.keys(statsMap).length} upserted=${upsertResults.upserted}`
    );

    return {
      weekStart,
      usersReported: Object.keys(statsMap).length,
      ...upsertResults,
    };
  }
);
