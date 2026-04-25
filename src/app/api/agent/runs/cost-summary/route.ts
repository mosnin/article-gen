import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminClient();
  const now = new Date();
  const day = new Date(now); day.setUTCHours(0, 0, 0, 0);
  const week = new Date(now); week.setUTCDate(week.getUTCDate() - 7);
  const month = new Date(now); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);

  const sumSince = async (since: Date) => {
    const { data } = await admin
      .from("agent_runs")
      .select("cost_usd, tokens_in, tokens_out")
      .eq("user_id", user.id)
      .gte("created_at", since.toISOString())
      .limit(5000);
    let cost = 0, tin = 0, tout = 0;
    for (const r of data ?? []) {
      cost += Number(r.cost_usd ?? 0);
      tin += Number(r.tokens_in ?? 0);
      tout += Number(r.tokens_out ?? 0);
    }
    return { costUsd: Math.round(cost * 10000) / 10000, tokensIn: tin, tokensOut: tout };
  };

  const [d, w, m] = await Promise.all([sumSince(day), sumSince(week), sumSince(month)]);
  return NextResponse.json({ day: d, week: w, month: m });
}
