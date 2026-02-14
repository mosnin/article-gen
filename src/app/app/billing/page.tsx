"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Suspense } from "react";
import AppShell from "@/components/app-shell";

interface CreditInfo {
  credits: number;
  plan: string;
  role: string;
  isAdmin: boolean;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

const PLANS = [
  { key: "free", name: "Free", price: 0, credits: 10, features: ["10 articles/month", "Standard quality", "Email support"] },
  { key: "starter", name: "Starter", price: 29, credits: 50, features: ["50 articles/month", "Premium quality", "Priority support", "Topic clusters"] },
  { key: "growth", name: "Growth", price: 50, credits: 120, features: ["120 articles/month", "Premium quality", "Priority support", "Topic clusters", "Batch generation"] },
  { key: "pro", name: "Pro", price: 99, credits: 300, features: ["300 articles/month", "Premium quality", "Dedicated support", "Topic clusters", "Batch generation", "API access"] },
];

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchData = useCallback(async () => {
    const [creditRes, { data: { user } }] = await Promise.all([
      fetch("/api/credits"),
      supabase.auth.getUser(),
    ]);

    const creditData = await creditRes.json();
    setCreditInfo(creditData);

    if (user) {
      const { data: txns } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setTransactions(txns || []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
    if (searchParams.get("success") === "true") {
      setSuccessMessage("Subscription activated! Your credits have been updated.");
      setTimeout(() => setSuccessMessage(""), 5000);
    }
  }, [fetchData, searchParams]);

  const handleSubscribe = async (planKey: string) => {
    if (planKey === "free") return;
    setCheckoutLoading(planKey);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to create checkout session");
      }
    } catch {
      alert("Failed to start checkout");
    }
    setCheckoutLoading(null);
  };

  const handleManageBilling = async () => {
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open billing portal");
      }
    } catch {
      alert("Failed to open billing portal");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
      </div>
    );
  }

  return (
    <AppShell title="Billing" onSignOut={handleLogout}>
        {successMessage && (
          <div style={{
            padding: "12px 20px",
            borderRadius: 10,
            background: "#dcfce7",
            color: "#166534",
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 24,
          }}>
            {successMessage}
          </div>
        )}

        {/* Current Plan */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Billing & Credits</h1>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Manage your subscription and credits</p>
        </div>

        <div className="mb-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div style={{
            flex: 1,
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            borderRadius: 12,
            padding: "24px",
          }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Current Plan</div>
            <div style={{ fontSize: 24, fontWeight: 700, textTransform: "capitalize" }}>
              {creditInfo?.isAdmin ? "Admin" : creditInfo?.plan || "Free"}
            </div>
          </div>
          <div style={{
            flex: 1,
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            borderRadius: 12,
            padding: "24px",
          }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Credits Remaining</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {creditInfo?.isAdmin ? "Unlimited" : creditInfo?.credits ?? 0}
            </div>
          </div>
          {creditInfo?.plan !== "free" && !creditInfo?.isAdmin && (
            <div style={{
              flex: 1,
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              borderRadius: 12,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}>
              <button
                onClick={handleManageBilling}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Manage Subscription
              </button>
            </div>
          )}
        </div>

        {/* Plans */}
        {!creditInfo?.isAdmin && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Plans</h2>
            <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {PLANS.map((plan) => {
                const isCurrent = creditInfo?.plan === plan.key;
                return (
                  <div
                    key={plan.key}
                    style={{
                      background: "var(--card)",
                      border: isCurrent ? "2px solid var(--accent)" : "1px solid var(--card-border)",
                      borderRadius: 12,
                      padding: "24px 20px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
                      {plan.price === 0 ? "Free" : `$${plan.price}`}
                      {plan.price > 0 && <span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)" }}>/mo</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                      {plan.credits} credits/month
                    </div>
                    <ul style={{ fontSize: 13, lineHeight: 2, marginBottom: 20, flex: 1, paddingLeft: 0, listStyle: "none" }}>
                      {plan.features.map((f) => (
                        <li key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <div style={{
                        padding: "10px",
                        borderRadius: 8,
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: 600,
                        background: "var(--card-border)",
                        color: "var(--foreground)",
                      }}>
                        Current Plan
                      </div>
                    ) : plan.key === "free" ? null : (
                      <button
                        onClick={() => handleSubscribe(plan.key)}
                        disabled={checkoutLoading === plan.key}
                        style={{
                          padding: "10px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          background: "var(--accent)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          opacity: checkoutLoading === plan.key ? 0.6 : 1,
                        }}
                      >
                        {checkoutLoading === plan.key ? "Loading..." : creditInfo?.plan === "free" ? "Subscribe" : "Switch Plan"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Transaction History */}
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Credit History</h2>
        {transactions.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No transactions yet</p>
        ) : (
          <div style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}>
            {transactions.map((t, i) => (
              <div
                key={t.id}
                style={{
                  padding: "14px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  borderBottom: i < transactions.length - 1 ? "1px solid var(--card-border)" : "none",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{t.description || t.type}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {new Date(t.created_at).toLocaleDateString()} at {new Date(t.created_at).toLocaleTimeString()}
                  </div>
                </div>
                <span style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: t.amount > 0 ? "var(--success)" : "var(--error)",
                }}>
                  {t.amount > 0 ? "+" : ""}{t.amount} credit{Math.abs(t.amount) !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
    </AppShell>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
