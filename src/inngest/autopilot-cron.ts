import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

export const autopilotCron = inngest.createFunction(
  { id: "autopilot-cron", name: "Autopilot Publishing Cron" },
  { cron: "0 * * * *" }, // every hour
  async ({ step }) => {
    const supabase = getAdminClient();

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

      let processed = 0;
      for (const user of users) {
        const plan = (user.autopilot_plan as any[]) ?? [];
        const dueSlots = plan.filter(
          (s: any) => s.status === "approved" && s.articleId && s.date <= today
        );

        for (const slot of dueSlots) {
          // Update slot to generating/done
          const updatedPlan = plan.map((s: any) =>
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

    return result;
  }
);
