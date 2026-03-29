import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { batchCheckUniqueness } from "@/lib/embeddings";
import type { AutopilotSlot } from "../generate-plan/route";

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load current plan
  const { data: settings } = await supabase
    .from("user_settings")
    .select("autopilot_plan")
    .eq("user_id", user.id)
    .single();

  const plan = ((settings?.autopilot_plan as AutopilotSlot[]) ?? []);
  if (plan.length === 0) return NextResponse.json({ slots: [] });

  // Only recheck pending/approved slots (done/failed don't need it)
  const toCheck = plan.filter((s) => s.status === "pending" || s.status === "approved");

  if (toCheck.length === 0) return NextResponse.json({ slots: plan });

  let recheckResults: Array<{
    keyword: string;
    topic: string;
    contentType: string;
    uniquenessScore: number;
    cannibalizesTitle: string | null;
    cannibalizesKeyword: string | null;
  }>;

  try {
    recheckResults = await batchCheckUniqueness({
      userId: user.id,
      topics: toCheck.map((s) => ({
        keyword: s.keyword,
        topic: s.topic,
        contentType: s.contentType,
      })),
      threshold: 0.82,
    });
  } catch (err) {
    console.error("[recheck-uniqueness]", err);
    return NextResponse.json({ error: "Uniqueness check failed" }, { status: 500 });
  }

  // Map results back onto the plan by position
  const recheckMap = new Map(toCheck.map((s, i) => [s.id, recheckResults[i]]));

  const updatedPlan: AutopilotSlot[] = plan.map((slot) => {
    const result = recheckMap.get(slot.id);
    if (!result) return slot;
    return {
      ...slot,
      uniquenessScore: result.uniquenessScore,
      cannibalizesTitle: result.cannibalizesTitle,
      cannibalizesKeyword: result.cannibalizesKeyword,
    };
  });

  // Persist
  await supabase
    .from("user_settings")
    .update({ autopilot_plan: updatedPlan })
    .eq("user_id", user.id);

  return NextResponse.json({ slots: updatedPlan, rechecked: toCheck.length });
}
