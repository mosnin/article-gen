import { NextRequest, NextResponse } from "next/server";
import { getStripe, PLANS, getPlanByPriceId } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";

// Use service role key for webhook to bypass RLS
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createServerClient(supabaseUrl, serviceKey, {
    cookies: {
      getAll() { return []; },
      setAll() {},
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Deduplicate Stripe events — Stripe retries on failure which can cause
  // double-credit grants. Use INSERT...ON CONFLICT to skip already-processed events.
  const { error: dedupError } = await supabase
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type })
    .select()
    .single();

  if (dedupError?.code === "23505") {
    // Unique violation — already processed, return 200 to stop retries
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan as keyof typeof PLANS | undefined;

      if (userId && plan && PLANS[plan]) {
        await supabase
          .from("user_profiles")
          .update({
            stripe_subscription_id: session.subscription as string,
            subscription_plan: plan,
            subscription_status: "active",
            credits: PLANS[plan].credits,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        await supabase.from("credit_transactions").insert({
          user_id: userId,
          amount: PLANS[plan].credits,
          type: "purchase",
          description: `Subscribed to ${PLANS[plan].name} plan (${PLANS[plan].credits} credits)`,
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId && invoice.billing_reason === "subscription_cycle") {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (profile) {
          const planCredits = PLANS[profile.subscription_plan as keyof typeof PLANS]?.credits || 10;

          await supabase
            .from("user_profiles")
            .update({
              credits: planCredits,
              subscription_status: "active",
              current_period_start: invoice.period_start
                ? new Date((invoice.period_start as number) * 1000).toISOString()
                : null,
              current_period_end: invoice.period_end
                ? new Date((invoice.period_end as number) * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", profile.user_id);

          await supabase.from("credit_transactions").insert({
            user_id: profile.user_id,
            amount: planCredits,
            type: "subscription_reset",
            description: `Monthly credit reset: ${planCredits} credits`,
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const subId = subscription.id as string;
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("stripe_subscription_id", subId)
        .single();

      if (profile) {
        const items = subscription.items as { data: Array<{ price?: { id?: string } }> };
        const priceId = items?.data?.[0]?.price?.id;
        const newPlan = priceId ? getPlanByPriceId(priceId) : null;

        const updates: Record<string, unknown> = {
          subscription_status: subscription.status as string,
          updated_at: new Date().toISOString(),
        };

        if (subscription.current_period_start) {
          updates.current_period_start = new Date((subscription.current_period_start as number) * 1000).toISOString();
        }
        if (subscription.current_period_end) {
          updates.current_period_end = new Date((subscription.current_period_end as number) * 1000).toISOString();
        }

        if (newPlan && newPlan !== profile.subscription_plan) {
          updates.subscription_plan = newPlan;
          updates.credits = PLANS[newPlan].credits;

          await supabase.from("credit_transactions").insert({
            user_id: profile.user_id,
            amount: PLANS[newPlan].credits,
            type: "purchase",
            description: `Plan changed to ${PLANS[newPlan].name} (${PLANS[newPlan].credits} credits)`,
          });
        }

        await supabase
          .from("user_profiles")
          .update(updates)
          .eq("user_id", profile.user_id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const deletedSub = event.data.object as unknown as Record<string, unknown>;
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("stripe_subscription_id", deletedSub.id as string)
        .single();

      if (profile) {
        await supabase
          .from("user_profiles")
          .update({
            subscription_plan: "free",
            subscription_status: "canceled",
            stripe_subscription_id: null,
            credits: PLANS.free.credits,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", profile.user_id);

        await supabase.from("credit_transactions").insert({
          user_id: profile.user_id,
          amount: PLANS.free.credits,
          type: "subscription_reset",
          description: "Subscription canceled, reverted to Free plan",
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
