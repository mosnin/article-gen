import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

export const PLANS = {
  free: {
    name: "Free",
    credits: 10,
    price: 0,
    priceId: null,
  },
  starter: {
    name: "Starter",
    credits: 50,
    price: 29,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || null,
  },
  growth: {
    name: "Growth",
    credits: 120,
    price: 50,
    priceId: process.env.STRIPE_GROWTH_PRICE_ID || null,
  },
  pro: {
    name: "Pro",
    credits: 300,
    price: 99,
    priceId: process.env.STRIPE_PRO_PRICE_ID || null,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByPriceId(priceId: string): PlanKey | null {
  // The dedicated trial price converts onto the starter plan.
  if (priceId && priceId === process.env.STRIPE_TRIAL_PRICE_ID) return "starter";
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return key as PlanKey;
  }
  return null;
}
