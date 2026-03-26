import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";
import { getOrCreateProfile } from "@/lib/credits";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getOrCreateProfile(supabase, user.id);

    // Check if already on a paid plan / already trialed
    if (profile.subscription_plan && profile.subscription_plan !== "free") {
      return NextResponse.json({ error: "Already on a paid plan" }, { status: 400 });
    }

    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // $1 trial checkout — uses the starter plan with a 3-day trial period.
    // The $1 is a one-time setup/verification fee added as an invoice item.
    // If STRIPE_TRIAL_PRICE_ID is set, use it; otherwise fall back to starter.
    const trialPriceId =
      process.env.STRIPE_TRIAL_PRICE_ID ||
      process.env.STRIPE_STARTER_PRICE_ID;

    if (!trialPriceId) {
      return NextResponse.json(
        { error: "Trial price not configured. Set STRIPE_TRIAL_PRICE_ID." },
        { status: 500 }
      );
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: trialPriceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 3,
        metadata: { supabase_user_id: user.id, trial: "true" },
      },
      payment_method_collection: "always",
      success_url: `${origin}/app/onboarding?trial=1`,
      cancel_url: `${origin}/trial?canceled=1`,
      metadata: {
        supabase_user_id: user.id,
        trial: "true",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    logger.error("Failed to start trial", error);
    return NextResponse.json({ error: "Failed to start trial" }, { status: 500 });
  }
}
