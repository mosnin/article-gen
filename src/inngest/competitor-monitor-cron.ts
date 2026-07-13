import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

export const competitorMonitorCron = inngest.createFunction(
  {
    id: "competitor-monitor-cron",
    name: "Competitor monitor cron",
    retries: 1,
    triggers: [{ cron: "30 3 * * *" }],
  },
  async () => {
    const admin = getAdminClient();
    const { data: rows } = await admin
      .from("competitors")
      .select("user_id")
      .eq("active", true)
      .limit(2000);
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
      if (!niche) continue;
      await inngest.send({
        name: "agent/article.generate",
        data: {
          userId,
          kind: "competitor_monitor",
          topic: niche,
          quality: "standard",
        },
      });
      dispatched++;
      if (dispatched >= 200) break;
    }
    return { dispatched, usersScanned: seen.size };
  },
);
