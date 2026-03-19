import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptCredential } from "@/lib/wp-crypto";
import type { ShopifyAccount } from "@/lib/publish-platforms";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accountId } = await req.json() as { accountId?: string };

    const { data: settings } = await supabase
      .from("user_settings")
      .select("shopify_accounts")
      .eq("user_id", user.id)
      .single();

    const accounts = (settings?.shopify_accounts as ShopifyAccount[]) ?? [];
    const account = accountId ? accounts.find((a) => a.id === accountId) : accounts[0];

    if (!account?.shopDomain || !account?.accessToken) {
      return NextResponse.json({ ok: false, message: "No Shopify account found." });
    }

    const accessToken = decryptCredential(account.accessToken);
    const shopDomain = account.shopDomain.replace(/\/$/, "");

    const res = await fetch(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ ok: false, message: "Authentication failed. Check your access token." });
      }
      return NextResponse.json({ ok: false, message: `Shopify returned ${res.status}.` });
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, message: `Connected to ${data.shop?.name || shopDomain}` });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 500 });
  }
}
