"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface UserProfile {
  user_id: string;
  role: string;
  credits: number;
  subscription_plan: string;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
  article_count: number;
  recent_transactions: Transaction[];
}

const PLAN_CLASSES: Record<string, string> = {
  free:    "text-[var(--text-tertiary)]",
  starter: "text-blue-500",
  growth:  "text-green-500",
  pro:     "text-purple-500",
};

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState<Record<string, string>>({});
  const [grantMessage, setGrantMessage] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403) {
        router.replace("/app");
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setUsers(data.users || []);
      }
    } catch {
      setError("Failed to load users");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleGrantCredits = async (userId: string) => {
    const amount = parseInt(grantAmount[userId] || "0");
    if (!amount || amount <= 0) return;

    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount, description: `Admin granted ${amount} credits` }),
      });
      const data = await res.json();
      if (data.success) {
        setGrantMessage((prev) => ({ ...prev, [userId]: `Added ${amount} credits` }));
        setGrantAmount((prev) => ({ ...prev, [userId]: "" }));
        fetchUsers();
        setTimeout(() => setGrantMessage((prev) => ({ ...prev, [userId]: "" })), 3000);
      } else {
        setGrantMessage((prev) => ({ ...prev, [userId]: data.error || "Failed" }));
      }
    } catch {
      setGrantMessage((prev) => ({ ...prev, [userId]: "Failed to grant credits" }));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const filteredUsers = users.filter((u) =>
    u.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.subscription_plan.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Don't render anything until auth check completes — prevents flash of admin UI
  if (loading && users.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-label="Loading">
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-base)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--surface-base)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/app")}
              className="flex items-center gap-2.5 text-[var(--text-primary)] hover:opacity-80 transition-opacity"
            >
              <Image src="/logo.png" alt="Article Sauce" width={28} height={28} />
              <span className="text-[17px] font-bold">Article Sauce</span>
            </button>
            <span className="text-[var(--text-tertiary)]">/</span>
            <span className="text-sm font-semibold text-[var(--error,#ef4444)]">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/app")}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-colors"
            >
              Back to App
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Manage users, credits, and subscriptions</p>
        </div>

        {/* Stats overview */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Users",    value: users.length },
            { label: "Paid Users",     value: users.filter((u) => u.subscription_plan !== "free").length },
            { label: "Admin Accounts", value: users.filter((u) => u.role === "admin").length },
            { label: "Total Articles", value: users.reduce((sum, u) => sum + u.article_count, 0) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-5 py-4"
            >
              <p className="text-xs text-[var(--text-tertiary)]">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Search by user ID, plan, or role…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        {/* Users list */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-[var(--text-tertiary)]">
            <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <p className="text-sm">Loading users…</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-[var(--error,#ef4444)]">{error}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredUsers.map((u) => (
              <div
                key={u.user_id}
                className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)]"
              >
                {/* User row — clickable to expand */}
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[var(--surface-sunken)] transition-colors"
                  onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}
                  aria-expanded={expandedUser === u.user_id}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-sm font-bold text-[var(--accent)]">
                      {u.role === "admin" ? "A" : "U"}
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {u.user_id.slice(0, 8)}…{u.user_id.slice(-4)}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                        Joined {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Plan */}
                    <div className="hidden text-center sm:block">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Plan</p>
                      <p className={`text-sm font-semibold ${PLAN_CLASSES[u.subscription_plan] ?? "text-[var(--text-primary)]"}`}>
                        {u.subscription_plan.charAt(0).toUpperCase() + u.subscription_plan.slice(1)}
                      </p>
                    </div>
                    {/* Credits */}
                    <div className="hidden text-center sm:block">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Credits</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {u.role === "admin" ? "∞" : u.credits}
                      </p>
                    </div>
                    {/* Articles */}
                    <div className="hidden text-center sm:block">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Articles</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{u.article_count}</p>
                    </div>
                    {/* Role badge */}
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      u.role === "admin"
                        ? "bg-[var(--error,#ef4444)] text-white"
                        : "border border-[var(--border-default)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]"
                    }`}>
                      {u.role}
                    </span>
                    {/* Chevron */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className={`shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${
                        expandedUser === u.user_id ? "rotate-180" : ""
                      }`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {/* Expanded details */}
                {expandedUser === u.user_id && (
                  <div className="border-t border-[var(--border-default)] px-5 pb-5 pt-4">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {/* Account details */}
                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Account Details</h3>
                        <dl className="space-y-2 text-sm">
                          {[
                            { label: "User ID",    value: <span className="font-mono text-xs">{u.user_id}</span> },
                            { label: "Plan",       value: u.subscription_plan },
                            { label: "Status",     value: u.subscription_status || "N/A" },
                            { label: "Stripe ID",  value: u.stripe_customer_id || "None" },
                            { label: "Credits",    value: u.role === "admin" ? "Unlimited" : u.credits },
                            { label: "Articles",   value: u.article_count },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex gap-2">
                              <dt className="w-20 shrink-0 text-[var(--text-tertiary)]">{label}</dt>
                              <dd className="text-[var(--text-primary)]">{value}</dd>
                            </div>
                          ))}
                        </dl>

                        {/* Grant credits */}
                        {u.role !== "admin" && (
                          <div className="mt-4">
                            <h4 className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Add Credits</h4>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                placeholder="Amount"
                                value={grantAmount[u.user_id] || ""}
                                onChange={(e) =>
                                  setGrantAmount((prev) => ({ ...prev, [u.user_id]: e.target.value }))
                                }
                                className="w-24 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                              />
                              <button
                                onClick={() => handleGrantCredits(u.user_id)}
                                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                              >
                                Add Credits
                              </button>
                            </div>
                            {grantMessage[u.user_id] && (
                              <p className="mt-1.5 text-xs text-green-600">{grantMessage[u.user_id]}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Recent transactions */}
                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Recent Transactions</h3>
                        {u.recent_transactions.length === 0 ? (
                          <p className="text-sm text-[var(--text-tertiary)]">No transactions yet</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {u.recent_transactions.map((t) => (
                              <div
                                key={t.id}
                                className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs"
                              >
                                <div>
                                  <p className="font-medium text-[var(--text-primary)]">{t.description || t.type}</p>
                                  <p className="mt-0.5 text-[var(--text-tertiary)]">
                                    {new Date(t.created_at).toLocaleDateString()}{" "}
                                    {new Date(t.created_at).toLocaleTimeString()}
                                  </p>
                                </div>
                                <span className={`ml-4 font-bold ${t.amount > 0 ? "text-green-600" : "text-[var(--error,#ef4444)]"}`}>
                                  {t.amount > 0 ? "+" : ""}{t.amount}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
