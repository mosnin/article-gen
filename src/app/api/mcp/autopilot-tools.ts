import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { defineTool, jsonResult, errorResult } from "@/lib/mcp/context";
import type { McpAuth } from "@/lib/mcp/auth";

type Slot = { id: string; status: string; articleId?: string | null; [key: string]: unknown };

async function loadPlan(userId: string): Promise<Slot[]> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("user_settings")
    .select("autopilot_plan")
    .eq("user_id", userId)
    .single();
  return (data?.autopilot_plan as Slot[]) ?? [];
}

export function registerAutopilotTools(server: McpServer, auth: McpAuth) {
  defineTool(server, auth, {
    name: "get_autopilot_plan",
    description: "Get the current autopilot content plan, niche, and enabled state.",
    scope: "read",
    schema: {},
    handler: async () => {
      const supabase = getAdminClient();
      const { data } = await supabase
        .from("user_settings")
        .select("autopilot_plan, autopilot_niche, autopilot_enabled, autopilot_last_generated")
        .eq("user_id", auth.userId)
        .single();
      return jsonResult(data ?? {});
    },
  });

  defineTool(server, auth, {
    name: "approve_autopilot_slot",
    description: "Approve a single pending slot in the autopilot plan so it becomes eligible for generation.",
    scope: "write",
    schema: { slot_id: z.string() },
    handler: async ({ slot_id }) => {
      const supabase = getAdminClient();
      const plan = await loadPlan(auth.userId);
      if (!plan.some((s) => s.id === slot_id)) return errorResult("Slot not found");
      const updated = plan.map((s) => (s.id === slot_id ? { ...s, status: "approved" } : s));
      await supabase.from("user_settings").update({ autopilot_plan: updated }).eq("user_id", auth.userId);
      return jsonResult({ approved: true, slotId: slot_id });
    },
  });

  defineTool(server, auth, {
    name: "approve_all_autopilot_slots",
    description: "Approve every pending slot in the autopilot plan.",
    scope: "write",
    schema: {},
    handler: async () => {
      const supabase = getAdminClient();
      const plan = await loadPlan(auth.userId);
      const updated = plan.map((s) => (s.status === "pending" ? { ...s, status: "approved" } : s));
      const approvedCount = updated.filter((s) => s.status === "approved").length;
      await supabase.from("user_settings").update({ autopilot_plan: updated }).eq("user_id", auth.userId);
      return jsonResult({ approvedCount });
    },
  });

  defineTool(server, auth, {
    name: "get_pending_articles",
    description: "Get approved autopilot slots that are waiting to be generated.",
    scope: "read",
    schema: {},
    handler: async () => {
      const plan = await loadPlan(auth.userId);
      return jsonResult(plan.filter((s) => s.status === "approved" && !s.articleId));
    },
  });
}
