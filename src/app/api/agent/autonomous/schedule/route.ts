import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase-server";
import { inngest } from "@/lib/inngest";

export const runtime = "nodejs";

type Schedule = {
  id: string;
  name: string;
  niche: string;
  tone?: string;
  targetAudience?: string;
  platforms?: Array<{ kind: string; id: string }>;
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { scheduleId: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.scheduleId) return NextResponse.json({ error: "scheduleId_required" }, { status: 400 });

  const { data } = await supabase.from("user_settings")
    .select("autonomous_schedules")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const list = (data as { autonomous_schedules?: Schedule[] } | null)?.autonomous_schedules ?? [];
  const sched = list.find((s) => s.id === body.scheduleId);
  if (!sched) return NextResponse.json({ error: "schedule_not_found" }, { status: 404 });

  await inngest.send({
    name: "agent/article.generate",
    data: {
      userId: auth.user.id,
      kind: "autopilot",
      topic: `${sched.niche} — upcoming post`,
      focusKeyword: sched.niche,
      tone: sched.tone,
      targetAudience: sched.targetAudience,
      quality: "standard",
      options: {
        autoPublish: (sched.platforms?.length ?? 0) > 0,
        platforms: sched.platforms ?? [],
      },
    },
  });

  return NextResponse.json({ ok: true });
}
