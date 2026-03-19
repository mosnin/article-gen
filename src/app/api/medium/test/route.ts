import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import type { MediumAccount } from "@/lib/publish-platforms";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accountId } = await req.json() as { accountId?: string };

    const { data: settings } = await supabase
      .from("user_settings")
      .select("medium_accounts")
      .eq("user_id", user.id)
      .single();

    const accounts = (settings?.medium_accounts as MediumAccount[]) ?? [];
    const account = accountId ? accounts.find((a) => a.id === accountId) : accounts[0];

    if (!account?.integrationToken) {
      return NextResponse.json({ ok: false, message: "No Medium account found." });
    }

    const token = decryptCredential(account.integrationToken);

    const res = await fetch("https://api.medium.com/v1/me", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json({ ok: false, message: "Authentication failed. Check your integration token." });
      }
      return NextResponse.json({ ok: false, message: `Medium returned ${res.status}.` });
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, message: `Connected as @${data.data?.username || "unknown"}` });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 500 });
  }
}
