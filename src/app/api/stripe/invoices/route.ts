import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";
import { getOrCreateProfile } from "@/lib/credits";

export interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  date: number;
  pdfUrl: string | null;
  hostedUrl: string | null;
  description: string | null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getOrCreateProfile(supabase, user.id);
    if (!profile.stripe_customer_id) {
      return NextResponse.json({ invoices: [] });
    }

    const stripe = getStripe();
    const { data } = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit: 24,
      status: "paid",
    });

    const invoices: Invoice[] = data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount: inv.amount_paid,
      currency: inv.currency,
      status: inv.status ?? "unknown",
      date: inv.created,
      pdfUrl: inv.invoice_pdf ?? null,
      hostedUrl: inv.hosted_invoice_url ?? null,
      description: inv.description ?? (inv.lines.data[0]?.description ?? null),
    }));

    return NextResponse.json({ invoices });
  } catch {
    return NextResponse.json({ invoices: [] });
  }
}
