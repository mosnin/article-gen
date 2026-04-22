import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

type AutonomousSchedule = {
  id?: string;
  userId?: string;
  name?: string;
  cadence?: "daily" | "weekly" | "monthly" | string;
  niche?: string;
  tone?: string;
  targetAudience?: string;
  platforms?: string[];
  status?: "active" | "paused" | string;
  nextRunAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export const autopilotCron = inngest.createFunction(
  { id: "autopilot-cron", name: "Autopilot Publishing Cron", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    const supabase = getAdminClient();

    // ── Pass 1: existing autopilot_plan handling ─────────────────────────────
    // Find all users with autopilot_enabled=true
    // For each user, check their autopilot_plan for slots with:
    //   - status="approved"
    //   - date <= today
    //   - articleId is not null
    // For each qualifying slot, find the article and publish it to the user's connected platforms
    // Update slot status to "done" after publishing

    const result = await step.run("process-autopilot-slots", async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data: users } = await supabase
        .from("user_settings")
        .select("user_id, autopilot_plan, autopilot_enabled, wp_blogs, domain")
        .eq("autopilot_enabled", true);

      if (!users?.length) return { processed: 0 };

      type Slot = { id: string; status: string; articleId: string | null; date: string; [key: string]: unknown };
      let processed = 0;
      for (const user of users) {
        const plan = (user.autopilot_plan as Slot[]) ?? [];
        const dueSlots = plan.filter(
          (s) => s.status === "approved" && s.articleId && s.date <= today
        );

        for (const slot of dueSlots) {
          // Update slot to generating/done
          const updatedPlan = plan.map((s) =>
            s.id === slot.id ? { ...s, status: "done" } : s
          );
          await supabase
            .from("user_settings")
            .update({ autopilot_plan: updatedPlan })
            .eq("user_id", user.user_id);
          processed++;
        }
      }
      return { processed };
    });

    // ── Pass 2: autonomous_schedules (spec §10) ──────────────────────────────
    // Enumerate every user's `user_settings.autonomous_schedules`; for each
    // active schedule whose `nextRunAt <= now`, dispatch `agent/article.generate`
    // and advance `nextRunAt` by the configured cadence.
    const dispatched = await step.run("process-autonomous-schedules", async () => {
      const { data: userRows } = await supabase
        .from("user_settings")
        .select("user_id, autonomous_schedules")
        .not("autonomous_schedules", "is", null);

      const nowIso = new Date().toISOString();
      let count = 0;

      for (const row of userRows ?? []) {
        const schedules = Array.isArray(row.autonomous_schedules)
          ? (row.autonomous_schedules as AutonomousSchedule[])
          : [];

        let mutated = false;

        for (const s of schedules) {
          if (s.status !== "active") continue;
          if (!s.nextRunAt || s.nextRunAt > nowIso) continue;

          await inngest.send({
            name: "agent/article.generate",
            data: {
              userId: row.user_id,
              kind: "autopilot",
              topic: `${s.niche} — upcoming post`,
              focusKeyword: s.niche,
              tone: s.tone,
              targetAudience: s.targetAudience,
              quality: "standard",
              options: {
                autoPublish: (s.platforms?.length ?? 0) > 0,
                platforms: s.platforms ?? [],
              },
            },
          });

          // bump nextRunAt by cadence (daily / weekly / monthly)
          const next = new Date();
          if (s.cadence === "daily") next.setUTCDate(next.getUTCDate() + 1);
          else if (s.cadence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
          else if (s.cadence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
          s.nextRunAt = next.toISOString();
          s.updatedAt = new Date().toISOString();

          mutated = true;
          count++;
        }

        if (mutated) {
          await supabase
            .from("user_settings")
            .update({ autonomous_schedules: schedules })
            .eq("user_id", row.user_id);
        }
      }

      return { dispatched: count };
    });

    return { ...result, ...dispatched };
  }
);
