import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import type { DevToAccount } from "@/lib/publish-platforms";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accountId } = await req.json() as { accountId?: string };

    const { data: settings } = await supabase
      .from("user_settings")
      .select("devto_accounts")
      .eq("user_id", user.id)
      .single();

    const accounts = (settings?.devto_accounts as DevToAccount[]) ?? [];
    const account = accountId ? accounts.find((a) => a.id === accountId) : accounts[0];

    if (!account?.apiKey) {
      return NextResponse.json({ ok: false, message: "No Dev.to account found." });
    }

    const apiKey = decryptCredential(account.apiKey);

    const res = await fetch("https://dev.to/api/users/me", {
      headers: { "api-key": apiKey },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json({ ok: false, message: "Authentication failed. Check your API key." });
      }
      return NextResponse.json({ ok: false, message: `Dev.to returned ${res.status}.` });
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, message: `Connected as @${data.username || "unknown"}` });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 500 });
  }
}
