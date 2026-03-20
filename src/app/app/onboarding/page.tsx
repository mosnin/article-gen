"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [siteName, setSiteName] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const res = await fetch("/api/onboarding/status");
        if (res.ok) {
          const data = await res.json();
          if (data.onboarding_complete === true) {
            router.push("/app");
          }
        }
      } catch {
        // ignore errors, just show onboarding
      }
    }
    checkOnboardingStatus();
  }, [router]);

  async function handleStep1Save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: siteName,
          domain: siteDomain,
          site_about: siteDescription,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save settings");
        return;
      }
      setStep(2);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteOnboarding() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to complete onboarding");
        return;
      }
      router.push("/app");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const platforms = [
    { name: "WordPress", emoji: "🌐" },
    { name: "Shopify", emoji: "🛒" },
    { name: "Medium", emoji: "Ⓜ️" },
    { name: "Ghost", emoji: "👻" },
    { name: "Dev.to", emoji: "👩‍💻" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
        }}
      >
        {/* Step indicator dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "32px",
          }}
        >
          {[1, 2, 3].map((dot) => (
            <div
              key={dot}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: dot === step ? "var(--accent)" : "var(--card-border)",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            borderRadius: "12px",
            padding: "40px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          {/* Step 1: Set up your site */}
          {step === 1 && (
            <>
              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "var(--foreground)",
                }}
              >
                Set up your site
              </h1>
              <p
                style={{
                  margin: "0 0 28px",
                  color: "var(--muted)",
                  fontSize: "14px",
                }}
              >
                Tell us about your website so we can tailor content for you.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--foreground)",
                      marginBottom: "6px",
                    }}
                  >
                    Site name
                  </label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="My Awesome Blog"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--card-border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--foreground)",
                      marginBottom: "6px",
                    }}
                  >
                    Site domain
                  </label>
                  <input
                    type="text"
                    value={siteDomain}
                    onChange={(e) => setSiteDomain(e.target.value)}
                    placeholder="yourblog.com"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--card-border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--foreground)",
                      marginBottom: "6px",
                    }}
                  >
                    Site description
                  </label>
                  <textarea
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    placeholder="A blog about technology, productivity, and modern life..."
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--card-border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "14px",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {error && (
                <p
                  style={{
                    color: "#ef4444",
                    fontSize: "13px",
                    marginTop: "12px",
                  }}
                >
                  {error}
                </p>
              )}

              <button
                onClick={handleStep1Save}
                disabled={saving}
                style={{
                  marginTop: "24px",
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : "Save & Continue →"}
              </button>
            </>
          )}

          {/* Step 2: Connect a publishing platform */}
          {step === 2 && (
            <>
              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "var(--foreground)",
                }}
              >
                Connect a publishing platform
              </h1>
              <p
                style={{
                  margin: "0 0 28px",
                  color: "var(--muted)",
                  fontSize: "14px",
                }}
              >
                Connect at least one platform to start publishing. You can always
                do this later in Settings.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  marginBottom: "28px",
                }}
              >
                {platforms.map((platform) => (
                  <button
                    key={platform.name}
                    onClick={() => router.push("/app/settings")}
                    title={platform.name}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      padding: "16px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--card-border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "500",
                      minWidth: "72px",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "var(--accent)";
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        "0 0 0 2px rgba(var(--accent-rgb, 99,102,241),0.15)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "var(--card-border)";
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                    }}
                  >
                    <span style={{ fontSize: "28px" }}>{platform.emoji}</span>
                    <span>{platform.name}</span>
                  </button>
                ))}
              </div>

              <div
                style={{
                  textAlign: "center",
                }}
              >
                <button
                  onClick={() => setStep(3)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted)",
                    fontSize: "14px",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: "4px 8px",
                  }}
                >
                  Skip for now →
                </button>
              </div>
            </>
          )}

          {/* Step 3: You're all set! */}
          {step === 3 && (
            <>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: "var(--success, #22c55e)",
                    marginBottom: "20px",
                  }}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                <h1
                  style={{
                    margin: "0 0 8px",
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "var(--foreground)",
                  }}
                >
                  {"You're all set!"}
                </h1>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "var(--foreground)",
                  }}
                >
                  Your workspace is ready
                </p>
                <p
                  style={{
                    margin: "0 0 32px",
                    color: "var(--muted)",
                    fontSize: "14px",
                  }}
                >
                  Everything is configured. Start generating high-quality articles
                  in seconds.
                </p>

                {error && (
                  <p
                    style={{
                      color: "#ef4444",
                      fontSize: "13px",
                      marginBottom: "16px",
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  onClick={handleCompleteOnboarding}
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    fontSize: "15px",
                    fontWeight: "600",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "Loading..." : "Start generating →"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
