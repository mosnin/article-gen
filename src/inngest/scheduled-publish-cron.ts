import { inngest } from "@/lib/inngest";
import { sweepScheduledPublishes } from "@/lib/publish/scheduled";

/**
 * Primary trigger for scheduled article publishing. Runs every 5 minutes and
 * sweeps articles whose publish_at has passed. The /api/cron/publish HTTP
 * route shares the same sweep for manual or external triggering.
 */
export const scheduledPublishCron = inngest.createFunction(
  {
    id: "scheduled-publish-cron",
    name: "Scheduled publish sweep",
    retries: 1,
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async () => {
    return sweepScheduledPublishes(25);
  },
);
