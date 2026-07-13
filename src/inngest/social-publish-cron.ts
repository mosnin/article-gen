import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

/**
 * Every 15 minutes, sweep social_snippets that are due (`scheduled_for <=
 * now()` AND `posted_at IS NULL`). Snippets are grouped by user_id so each
 * user receives a single agent run carrying all their due snippet ids.
 */
export const socialPublishCron = inngest.createFunction(
  {
    id: "social-publish-cron",
    name: "Social publish cron",
    retries: 1,
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async () => {
    const admin = getAdminClient();
    const nowIso = new Date().toISOString();

    const { data: rows, error } = await admin
      .from("social_snippets")
      .select("id, user_id, scheduled_for")
      .lte("scheduled_for", nowIso)
      .is("posted_at", null)
      .not("scheduled_for", "is", null)
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (error) {
      throw new Error(`social_snippets sweep failed: ${error.message}`);
    }

    const due = (rows ?? []) as Array<{
      id: string;
      user_id: string;
      scheduled_for: string;
    }>;

    if (due.length === 0) {
      return { dispatched: 0, snippetsDue: 0, usersScanned: 0 };
    }

    // Group by user_id.
    const byUser = new Map<string, string[]>();
    for (const r of due) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r.id);
      byUser.set(r.user_id, list);
    }

    let dispatched = 0;
    for (const [userId, snippetIds] of byUser) {
      await inngest.send({
        name: "agent/article.generate",
        data: {
          userId,
          kind: "social_publish",
          topic: "scheduled social publish",
          snippetIds,
          quality: "standard",
        },
      });
      dispatched++;
    }

    return {
      dispatched,
      snippetsDue: due.length,
      usersScanned: byUser.size,
    };
  },
);
