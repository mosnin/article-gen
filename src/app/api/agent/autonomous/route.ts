import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase-server";
import { randomUUID } from "node:crypto";

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
    updated = { ...current[idx], ...(body as Partial<Schedule>), id: body.id, updatedAt: now };
    current[idx] = updated;
  } else {
    updated = {
      id: randomUUID(),
      name: body.name!,
      cadence: body.cadence!,
      niche: body.niche!,
      tone: body.tone,
      targetAudience: body.targetAudience,
      platforms: body.platforms ?? [],
      status: body.status ?? "active",
      nextRunAt: body.nextRunAt ?? now,
      createdAt: now,
      updatedAt: now,
    };
    current.push(updated);
  }
  await putSchedules(supabase, auth.user.id, current);
  return NextResponse.json({ schedule: updated });
}
