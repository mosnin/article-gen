import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

/**
 * Weekly newsletter digest cron — Mondays at 09:00 UTC.
 *
 * Eligibility heuristic: dispatch a digest for every user that has at
 * least one article published in the last 7 days AND has a niche set in
 * `user_settings`. (No `newsletter_enabled` column exists yet — once it
 * does, swap the heuristic for a direct `user_settings.newsletter_enabled
 * === true` check.) Throttled to 200 dispatches per tick to keep the
 * burst manageable.
 */
export const newsletterCron = inngest.createFunction(
  { id: "newsletter-cron", name: "Weekly newsletter digest cron", retries: 1 },
  { cron: "0 9 * * 1" },
  async () => {
    const admin = getAdminClient();
    const cutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows } = await admin
      .from("articles")
      .select("user_id")
      .eq("lifecycle", "published")
      .gte("published_at", cutoffIso)
      .limit(5000);

    const seen = new Set<string>();
    let dispatched = 0;
    for (const r of rows ?? []) {
      const userId = (r as { user_id: string }).user_id;
      if (seen.has(userId)) continue;
      seen.add(userId);

      const { data: settings } = await admin
        .from("user_settings")
        .select("niche")
        .eq("user_id", userId)
        .maybeSingle();
      const niche = (settings as { niche?: string } | null)?.niche;
      if (!niche || niche.trim().length === 0) continue;

      await inngest.send({
        name: "agent/article.generate",
        data: {
          userId,
          kind: "newsletter_digest",
          topic: niche,
          newsletterPeriodDays: 7,
          quality: "standard",
        },
      });
      dispatched++;
      if (dispatched >= 200) break;
    }
    return { dispatched, usersScanned: seen.size };
  },
);
