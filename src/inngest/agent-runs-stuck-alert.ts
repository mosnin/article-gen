import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

const STUCK_AFTER_MINUTES = 10;

export const agentRunsStuckAlert = inngest.createFunction(
  { id: "agent-runs-stuck-alert", name: "Agent runs stuck alert", retries: 0 },
  { cron: "*/15 * * * *" }, // every 15 min
  async () => {
    const admin = getAdminClient();
    const threshold = new Date(Date.now() - STUCK_AFTER_MINUTES * 60 * 1000).toISOString();

    const { data: stuckRuns, error } = await admin
      .from("agent_runs")
      .select("id, user_id, topic, updated_at, current_step, current_agent")
      .eq("status", "running")
      .lt("updated_at", threshold);
    if (error) throw error;

    if (!stuckRuns || stuckRuns.length === 0) return { stuck: 0 };

    // Determine monotonic next seq per run; we'll just use -1 sentinel
    // (since seq is non-nullable, compute max + 1 per run via a quick roundtrip)
    let warned = 0;
    for (const run of stuckRuns) {
      const { data: maxRow } = await admin
        .from("agent_events")
        .select("seq")
        .eq("run_id", run.id)
        .order("seq", { ascending: false })
        .limit(1)
        .maybeSingle();
      const seq = (maxRow?.seq ?? 0) + 1;
      const { error: insErr } = await admin.from("agent_events").insert({
        run_id: run.id,
        seq,
        kind: "warning",
        agent_name: "operational",
        tool_name: null,
        message: `Run appears stuck (no update in ${STUCK_AFTER_MINUTES} min).`,
        payload: {
          currentStep: run.current_step,
          currentAgent: run.current_agent,
          lastUpdatedAt: run.updated_at,
        },
        duration_ms: null,
      });
      if (!insErr) warned++;
      console.error(
        `[agent-runs-stuck-alert] run=${run.id} user=${run.user_id} topic="${run.topic}" ` +
          `stuck since ${run.updated_at}`
      );
    }
    return { stuck: stuckRuns.length, warned };
  }
);
