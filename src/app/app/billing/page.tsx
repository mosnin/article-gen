"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void" | "uncollectible";
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

interface PlanInfo {
  plan: string;
  credits: number;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [credRes, invoiceRes] = await Promise.all([
        fetch("/api/credits"),
        fetch("/api/stripe/invoices").catch(() => null),
      ]);

      const credData = await credRes.json();
      setPlanInfo({
        plan: credData.plan ?? "free",
        credits: credData.credits ?? 0,
        trialEnd: credData.trialEnd ?? null,
        cancelAtPeriodEnd: credData.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: credData.currentPeriodEnd ?? null,
      });

      if (invoiceRes?.ok) {
        const invData = await invoiceRes.json();
        setInvoices(invData.invoices ?? []);
      } else {
        // Fallback: load from credit_transactions as mock invoices
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: txns } = await supabase
            .from("credit_transactions")
            .select("id, amount, created_at, description")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);

          if (txns?.length) {
            setInvoices(txns.map((t, i) => ({
              id: t.id,
              number: `INV-${String(i + 1).padStart(5, "0")}`,
              amount: Math.abs(t.amount) * 100,
              currency: "usd",
              status: "paid",
              created: new Date(t.created_at).getTime() / 1000,
              hosted_invoice_url: null,
              invoice_pdf: null,
            })));
          }
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated! Your credits have been updated.");
    }
  }, [load, searchParams]);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Could not open subscription management");
      }
    } catch {
      toast.error("Failed to open portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const isTrial = planInfo?.plan === "trial" || planInfo?.plan === "free";

  const trialDaysLeft = planInfo?.trialEnd
    ? Math.max(0, Math.ceil((new Date(planInfo.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-6">
      {/* Trial/subscription hero */}
      {isTrial && (
        <div className="relative overflow-hidden rounded-xl bg-[var(--accent)] px-6 py-8 text-white">
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              loading={portalLoading}
              className="border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              Manage Payment Methods
            </Button>
          </div>

          <div className="mb-1 inline-flex items-center rounded-full border border-amber-400 bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-300">
            Articles Trial
          </div>

          {trialDaysLeft !== null ? (
            <>
              <h1 className="mt-2 text-4xl font-black">{trialDaysLeft} days left</h1>
              <p className="mt-2 text-sm text-white/80">
                Your articles subscription trial ends on{" "}
                {planInfo?.trialEnd ? new Date(planInfo.trialEnd).toLocaleDateString("en-GB").replace(/\//g, ".") : "soon"},
                then your subscription automatically continues at $99.00/mo.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-2 text-3xl font-black">Free Plan</h1>
              <p className="mt-2 text-sm text-white/80">
                Upgrade to unlock unlimited articles, integrations, and priority support.
              </p>
            </>
          )}

          <Button
            onClick={handleManageSubscription}
            loading={portalLoading}
            className="mt-4 rounded-lg bg-white px-6 font-semibold text-[var(--accent)] hover:bg-white/90"
          >
            Upgrade Now
          </Button>

          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-8 right-20 h-32 w-32 rounded-full bg-white/5" />
        </div>
      )}

      {/* Invoices table */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)]">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Invoices</h2>
          <button
            onClick={handleManageSubscription}
            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Manage Subscription →
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-[var(--text-secondary)]">No invoices yet</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Your invoices will appear here once you start a subscription.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  {["Date", "Invoice Number", "Amount", "Status", "Actions"].map((col) => (
                    <th key={col} className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-tertiary)]">
                      {col === "Date" ? (
                        <div className="flex items-center gap-1">
                          {col}
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[var(--surface-sunken)]">
                    <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                      {new Date(inv.created * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-[var(--text-primary)]">
                      {inv.number}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-[var(--text-primary)]">
                      ${(inv.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        inv.status === "paid"
                          ? "bg-green-100 text-green-700"
                          : inv.status === "open"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                            title="View invoice"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                            </svg>
                          </a>
                        )}
                        {inv.invoice_pdf && (
                          <a
                            href={inv.invoice_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                            title="Download PDF"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </a>
                        )}
                        {!inv.hosted_invoice_url && !inv.invoice_pdf && (
                          <span className="text-xs text-[var(--text-tertiary)]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan info card */}
      {!isTrial && planInfo && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)] capitalize">{planInfo.plan} Plan</p>
              {planInfo.currentPeriodEnd && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {planInfo.cancelAtPeriodEnd ? "Cancels" : "Renews"} on{" "}
                  {new Date(planInfo.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleManageSubscription} loading={portalLoading}>
              Manage Subscription
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--text-secondary)]">Loading…</div>}>
      <BillingContent />
    </Suspense>
  );
}
