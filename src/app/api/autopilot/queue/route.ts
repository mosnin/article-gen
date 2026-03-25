import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { AutopilotSlot } from "../generate-plan/route";

// GET — load current plan
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("autopilot_plan, autopilot_niche, autopilot_last_generated, autopilot_enabled")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    slots: (settings?.autopilot_plan as AutopilotSlot[]) ?? [],
    niche: settings?.autopilot_niche ?? "",
    lastGenerated: settings?.autopilot_last_generated ?? null,
    enabled: settings?.autopilot_enabled ?? false,
  });
}

// POST — update slot statuses or trigger generation for a slot
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    action: "approve" | "reject" | "approve_all" | "update_slot" | "update_plan" | "set_enabled";
    slotId?: string;
    slots?: AutopilotSlot[];
    enabled?: boolean;
  };

  const { data: settings } = await supabase
    .from("user_settings")
    .select("autopilot_plan")
    .eq("user_id", user.id)
    .single();

  const plan = ((settings?.autopilot_plan as AutopilotSlot[]) ?? []);

  if (body.action === "approve" && body.slotId) {
    const updated = plan.map((s) =>
      s.id === body.slotId && s.status === "pending" ? { ...s, status: "approved" as const } : s
    );
    await supabase.from("user_settings").update({ autopilot_plan: updated }).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reject" && body.slotId) {
    const updated = plan.map((s) =>
      s.id === body.slotId ? { ...s, status: "rejected" as const } : s
    );
    await supabase.from("user_settings").update({ autopilot_plan: updated }).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "approve_all") {
    const updated = plan.map((s) =>
      s.status === "pending" ? { ...s, status: "approved" as const } : s
    );
    await supabase.from("user_settings").update({ autopilot_plan: updated }).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_slot" && body.slotId && body.slots) {
    const incoming = body.slots[0];
    const updated = plan.map((s) => s.id === body.slotId ? { ...s, ...incoming } : s);
    await supabase.from("user_settings").update({ autopilot_plan: updated }).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_plan" && body.slots) {
    await supabase.from("user_settings").update({ autopilot_plan: body.slots }).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_enabled") {
    await supabase.from("user_settings").update({ autopilot_enabled: body.enabled }).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
