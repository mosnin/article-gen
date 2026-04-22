import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

const RETENTION_DAYS = 30;

export const agentEventsRetention = inngest.createFunction(
  { id: "agent-events-retention", name: "Agent events retention", retries: 1 },
  { cron: "10 2 * * *" }, // 02:10 UTC daily
  async ({ step }) => {
    const admin = getAdminClient();
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // 1. find terminal-status run ids whose oldest event is older than cutoff
    const { data: terminalRuns, error: runsErr } = await admin
      .from("agent_runs")
      .select("id")
      .in("status", ["succeeded", "failed", "cancelled"])
      .lt("updated_at", cutoff);
    if (runsErr) throw runsErr;

    const runIds = (terminalRuns ?? []).map((r) => r.id);
    if (runIds.length === 0) return { deleted: 0, runsConsidered: 0 };

    // 2. delete events for those runs in chunks of 200 ids
    let totalDeleted = 0;
    for (let i = 0; i < runIds.length; i += 200) {
      const chunk = runIds.slice(i, i + 200);
      const { count, error: delErr } = await admin
        .from("agent_events")
        .delete({ count: "exact" })
        .in("run_id", chunk);
      if (delErr) throw delErr;
      totalDeleted += count ?? 0;
    }
    return { deleted: totalDeleted, runsConsidered: runIds.length, cutoff };
  }
);
