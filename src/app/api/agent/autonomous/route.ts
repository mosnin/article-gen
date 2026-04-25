import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase-server";
import { randomUUID } from "node:crypto";
import { computeNextRunAt } from "@/lib/schedule-next-run";

export const runtime = "nodejs";

type Schedule = {
  id: string;
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  niche: string;
  tone?: string;
  targetAudience?: string;
  platforms?: Array<{ kind: string; id: string }>;
  status: "active" | "paused";
  nextRunAt: string;     // ISO
  createdAt: string;
  updatedAt: string;
  // v2 fields (optional for back-compat)
  timezone?: string;
  timeOfDayLocal?: string;
  weekdayMask?: number[];
  requiresApproval?: boolean;
  topicSource?: "static_niche" | "topic_proposals" | "keyword_candidates";
};

async function getSchedules(supabase: Awaited<ReturnType<typeof createSupabaseServer>>, userId: string): Promise<Schedule[]> {
  const { data } = await supabase.from("user_settings")
    .select("autonomous_schedules")
    .eq("user_id", userId)
    .maybeSingle();
  return ((data as { autonomous_schedules?: Schedule[] } | null)?.autonomous_schedules) ?? [];
}

async function putSchedules(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  userId: string,
  schedules: Schedule[],
): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, autonomous_schedules: schedules, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

function safeComputeNextRun(input: {
  timezone?: string;
  timeOfDayLocal?: string;
  cadence: "daily" | "weekly" | "monthly";
  weekdayMask?: number[];
}): string {
  try {
    const iso = computeNextRunAt({
      timezone: input.timezone ?? "UTC",
      timeOfDayLocal: input.timeOfDayLocal ?? "09:00",
      cadence: input.cadence,
      weekdayMask: input.weekdayMask,
    });
    if (!iso || Number.isNaN(new Date(iso).getTime())) {
      return new Date().toISOString();
    }
    return iso;
  } catch {
    return new Date().toISOString();
  }
}

export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const schedules = await getSchedules(supabase, auth.user.id);
    return NextResponse.json({ schedules });
  } catch {
    return NextResponse.json({ schedules: [] });  // column likely not migrated yet
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Partial<Schedule> & { delete?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const current = await getSchedules(supabase, auth.user.id);
  const now = new Date().toISOString();

  if (body.delete) {
    const next = current.filter((s) => s.id !== body.delete);
    await putSchedules(supabase, auth.user.id, next);
    return NextResponse.json({ ok: true });
  }

  if (!body.name || !body.cadence || !body.niche) {
    return NextResponse.json({ error: "name/cadence/niche required" }, { status: 400 });
  }

  let updated: Schedule;
  if (body.id) {
    const idx = current.findIndex((s) => s.id === body.id);
    if (idx < 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const prev = current[idx];
    const merged: Schedule = {
      ...prev,
      ...(body as Partial<Schedule>),
      id: body.id,
      updatedAt: now,
    };
    // Recompute nextRunAt if any of the scheduling inputs changed.
    const schedulingChanged =
      (body.cadence !== undefined && body.cadence !== prev.cadence) ||
      (body.timezone !== undefined && body.timezone !== prev.timezone) ||
      (body.timeOfDayLocal !== undefined && body.timeOfDayLocal !== prev.timeOfDayLocal) ||
      (body.weekdayMask !== undefined);
    if (schedulingChanged) {
      merged.nextRunAt = safeComputeNextRun({
        timezone: merged.timezone,
        timeOfDayLocal: merged.timeOfDayLocal,
        cadence: merged.cadence,
        weekdayMask: merged.weekdayMask,
      });
    } else if (!merged.nextRunAt) {
      merged.nextRunAt = safeComputeNextRun({
        timezone: merged.timezone,
        timeOfDayLocal: merged.timeOfDayLocal,
        cadence: merged.cadence,
        weekdayMask: merged.weekdayMask,
      });
    }
    updated = merged;
    current[idx] = updated;
  } else {
    const timezone = body.timezone ?? "UTC";
    const timeOfDayLocal = body.timeOfDayLocal ?? "09:00";
    const weekdayMask = body.weekdayMask;
    const cadence = body.cadence!;
    const computedNext = safeComputeNextRun({ timezone, timeOfDayLocal, cadence, weekdayMask });
    updated = {
      id: randomUUID(),
      name: body.name!,
      cadence,
      niche: body.niche!,
      tone: body.tone,
      targetAudience: body.targetAudience,
      platforms: body.platforms ?? [],
      status: body.status ?? "active",
      nextRunAt: body.nextRunAt ?? computedNext,
      createdAt: now,
      updatedAt: now,
      timezone,
      timeOfDayLocal,
      weekdayMask: weekdayMask ?? (cadence === "weekly" ? [1, 2, 3, 4, 5] : undefined),
      requiresApproval: body.requiresApproval ?? false,
      topicSource: body.topicSource ?? "static_niche",
    };
    current.push(updated);
  }
  await putSchedules(supabase, auth.user.id, current);
  return NextResponse.json({ schedule: updated });
}
