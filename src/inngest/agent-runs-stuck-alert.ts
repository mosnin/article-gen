import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";

const STUCK_AFTER_MINUTES = 10;

async function postSlack(text: string, blocks?: unknown[]): Promise<void> {
  const url = process.env.SLACK_ALERTS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
  } catch (err) {
    console.error("[slack-alert]", err);
  }
}

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

    if (stuckRuns.length > 0) {
      const lines = stuckRuns.slice(0, 10).map((r) =>
        `• <${process.env.NEXT_PUBLIC_APP_URL}/app/agent-runs/${r.id}|${r.topic}> ` +
        `(agent: ${r.current_agent ?? "?"}, step: ${r.current_step ?? "?"}, ` +
        `since ${r.updated_at})`
      );
      const extra = stuckRuns.length > 10 ? `\n…and ${stuckRuns.length - 10} more.` : "";
      await postSlack(
        `:warning: *${stuckRuns.length} agent run${stuckRuns.length === 1 ? "" : "s"} ` +
        `stuck* (no update in ${STUCK_AFTER_MINUTES}min)\n${lines.join("\n")}${extra}`
      );
    }

    return { stuck: stuckRuns.length, warned };
  }
);
