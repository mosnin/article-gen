"use client";

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

  const planColors: Record<string, string> = {
    free: "#86868b",
    starter: "#007aff",
    growth: "#34c759",
    pro: "#af52de",
  };

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      {/* Header */}
      <header
        className="glass"
        style={{
          borderBottom: "1px solid var(--card-border)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              onClick={() => router.push("/app")}
            >
              <Image src="/logo.png" alt="Article Sauce" width={28} height={28} className="rounded-lg" style={{ boxShadow: "var(--shadow-sm)" }} />
              <span style={{ fontWeight: 700, fontSize: 17 }}>Article Sauce</span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>/</span>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--error)" }}>Admin Dashboard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => router.push("/app")}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                cursor: "pointer",
              }}
            >
              Back to App
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Admin Dashboard</h1>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Manage users, credits, and subscriptions</p>
        </div>

        {/* Stats Overview */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Users", value: users.length },
            { label: "Paid Users", value: users.filter((u) => u.subscription_plan !== "free").length },
            { label: "Admin Accounts", value: users.filter((u) => u.role === "admin").length },
            { label: "Total Articles", value: users.reduce((sum, u) => sum + u.article_count, 0) },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                borderRadius: 12,
                padding: "20px 24px",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Search by user ID, plan, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 400,
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--card-border)",
              background: "var(--card)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
            <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
            <p style={{ marginTop: 12 }}>Loading users...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--error)" }}>{error}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredUsers.map((u) => (
              <div
                key={u.user_id}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {/* User Row */}
                <div
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 600 }}>
                      {u.role === "admin" ? "A" : "U"}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{u.user_id.slice(0, 8)}...{u.user_id.slice(-4)}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        Joined {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Plan</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: planColors[u.subscription_plan] || "var(--foreground)" }}>
                        {u.subscription_plan.charAt(0).toUpperCase() + u.subscription_plan.slice(1)}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Credits</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {u.role === "admin" ? "Unlimited" : u.credits}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Articles</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u.article_count}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Role</div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: u.role === "admin" ? "var(--error)" : "var(--card-border)",
                        color: u.role === "admin" ? "#fff" : "var(--foreground)",
                      }}>
                        {u.role}
                      </div>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--muted)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{
                        transform: expandedUser === u.user_id ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedUser === u.user_id && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--card-border)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
                      {/* User Details */}
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Account Details</h3>
                        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                          <div><span style={{ color: "var(--muted)" }}>User ID:</span> <span style={{ fontFamily: "monospace", fontSize: 12 }}>{u.user_id}</span></div>
                          <div><span style={{ color: "var(--muted)" }}>Plan:</span> {u.subscription_plan}</div>
                          <div><span style={{ color: "var(--muted)" }}>Status:</span> {u.subscription_status || "N/A"}</div>
                          <div><span style={{ color: "var(--muted)" }}>Stripe ID:</span> {u.stripe_customer_id || "None"}</div>
                          <div><span style={{ color: "var(--muted)" }}>Credits:</span> {u.role === "admin" ? "Unlimited" : u.credits}</div>
                          <div><span style={{ color: "var(--muted)" }}>Articles:</span> {u.article_count}</div>
                        </div>

                        {/* Grant Credits */}
                        {u.role !== "admin" && (
                          <div style={{ marginTop: 16 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Add Credits</h4>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="number"
                                min="1"
                                placeholder="Amount"
                                value={grantAmount[u.user_id] || ""}
                                onChange={(e) => setGrantAmount((prev) => ({ ...prev, [u.user_id]: e.target.value }))}
                                style={{
                                  width: 100,
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  border: "1px solid var(--card-border)",
                                  background: "var(--background)",
                                  fontSize: 13,
                                  outline: "none",
                                }}
                              />
                              <button
                                onClick={() => handleGrantCredits(u.user_id)}
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  background: "var(--success)",
                                  color: "#fff",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                Add Credits
                              </button>
                            </div>
                            {grantMessage[u.user_id] && (
                              <div style={{ fontSize: 12, color: "var(--success)", marginTop: 6 }}>
                                {grantMessage[u.user_id]}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Recent Transactions */}
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent Transactions</h3>
                        {u.recent_transactions.length === 0 ? (
                          <p style={{ fontSize: 13, color: "var(--muted)" }}>No transactions yet</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {u.recent_transactions.map((t) => (
                              <div
                                key={t.id}
                                style={{
                                  fontSize: 12,
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  background: "var(--background)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 500 }}>{t.description || t.type}</div>
                                  <div style={{ color: "var(--muted)", marginTop: 2 }}>
                                    {new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString()}
                                  </div>
                                </div>
                                <span style={{
                                  fontWeight: 700,
                                  color: t.amount > 0 ? "var(--success)" : "var(--error)",
                                }}>
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
