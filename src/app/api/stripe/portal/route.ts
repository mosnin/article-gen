import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";
import { getOrCreateProfile } from "@/lib/credits";
import { getAppUrl } from "@/lib/app-url";
import { requireUser } from "@/lib/api-auth";

export async function POST() {
  try {
    const supabase = await createClient();
    const authResult = await requireUser(supabase);
    if ("response" in authResult) return authResult.response;
    const { user } = authResult;

    const profile = await getOrCreateProfile(supabase, user.id);

    if (!profile.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 });
    }

    const appUrl = getAppUrl();

    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/app/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
