import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";

export function registerAutopilotTools(server: McpServer) {

  server.tool("get_autopilot_plan",
    "Get the current content autopilot plan for a user",
    { user_id: z.string() },
    async ({ user_id }) => {
      const supabase = getAdminClient();
      const { data } = await supabase
        .from("user_settings")
        .select("autopilot_plan, autopilot_niche, autopilot_enabled, autopilot_last_generated")
        .eq("user_id", user_id)
        .single();
      return { content: [{ type: "text", text: JSON.stringify(data ?? {}) }] };
    }
  );

  server.tool("approve_autopilot_slot",
    "Approve a content slot in the autopilot plan",
    { user_id: z.string(), slot_id: z.string() },
    async ({ user_id, slot_id }) => {
      const supabase = getAdminClient();
      const { data: settings } = await supabase
        .from("user_settings").select("autopilot_plan").eq("user_id", user_id).single();
      const plan = (settings?.autopilot_plan as any[]) ?? [];
      const updated = plan.map((s: any) => s.id === slot_id ? { ...s, status: "approved" } : s);
      await supabase.from("user_settings").update({ autopilot_plan: updated }).eq("user_id", user_id);
      return { content: [{ type: "text", text: `Slot ${slot_id} approved` }] };
    }
  );

  server.tool("approve_all_autopilot_slots",
    "Approve all pending slots in the autopilot plan",
    { user_id: z.string() },
    async ({ user_id }) => {
      const supabase = getAdminClient();
      const { data: settings } = await supabase
        .from("user_settings").select("autopilot_plan").eq("user_id", user_id).single();
      const plan = (settings?.autopilot_plan as any[]) ?? [];
      const updated = plan.map((s: any) => s.status === "pending" ? { ...s, status: "approved" } : s);
      const approvedCount = updated.filter((s: any) => s.status === "approved").length;
      await supabase.from("user_settings").update({ autopilot_plan: updated }).eq("user_id", user_id);
      return { content: [{ type: "text", text: `Approved ${approvedCount} slots` }] };
    }
  );

  server.tool("get_pending_articles",
    "Get all approved autopilot slots that are ready to generate",
    { user_id: z.string() },
    async ({ user_id }) => {
      const supabase = getAdminClient();
      const { data: settings } = await supabase
        .from("user_settings").select("autopilot_plan").eq("user_id", user_id).single();
      const plan = (settings?.autopilot_plan as any[]) ?? [];
      const pending = plan.filter((s: any) => s.status === "approved" && !s.articleId);
      return { content: [{ type: "text", text: JSON.stringify(pending) }] };
    }
  );
}
