"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const TOTAL_STEPS = 3;

interface PlatformCard {
  name: string;
  description: string;
  icon: React.ReactNode;
}

function WordPressIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#21759b" strokeWidth="1.5" fill="#fff" />
      <path d="M3.6 12c0 3.54 2.06 6.61 5.05 8.08L4.3 9.18A8.4 8.4 0 0 0 3.6 12zm14.53-.38c0-1.1-.4-1.87-.74-2.46-.45-.74-.88-1.36-.88-2.1 0-.82.62-1.58 1.5-1.58l.11.01A8.4 8.4 0 0 0 12 3.6c-2.9 0-5.45 1.49-6.93 3.74l.53.02c.87 0 2.2-.11 2.2-.11.45-.02.5.63.06.68 0 0-.45.05-.95.08l3.02 8.98 1.81-5.44-1.29-3.54c-.44-.03-.86-.08-.86-.08-.44-.03-.39-.7.06-.68 0 0 1.36.11 2.17.11.87 0 2.2-.11 2.2-.11.45-.02.5.63.05.68 0 0-.45.05-.94.08l3 8.93.83-2.76c.36-.93.57-1.6.57-2.18zM12.2 12.8l-2.49 7.24a8.42 8.42 0 0 0 5.17-.14l-.06-.11-2.62-7zm7.2-4.76a6.62 6.62 0 0 1 .06.93c0 .92-.17 1.95-.69 3.24l-2.76 7.97A8.41 8.41 0 0 0 19.4 8.04z" fill="#21759b" />
    </svg>
  );
}

function MediumIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#000" />
      <ellipse cx="8.5" cy="12" rx="4.5" ry="5.5" fill="#fff" />
      <ellipse cx="17" cy="12" rx="2" ry="5" fill="#fff" />
      <rect x="21" y="7" width="1.5" height="10" rx="0.75" fill="#fff" />
    </svg>
  );
}

function DevToIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#0a0a0a" />
      <text x="3" y="17" fontSize="10" fontWeight="800" fill="#fff" fontFamily="monospace">
        DEV
      </text>
    </svg>
  );
}

function GhostIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#212121" />
      <path d="M12 4a6 6 0 0 0-6 6v8l2-2 2 2 2-2 2 2 2-2v-8a6 6 0 0 0-6-6z" fill="#fff" />
      <circle cx="10" cy="11" r="1" fill="#212121" />
      <circle cx="14" cy="11" r="1" fill="#212121" />
    </svg>
  );
}

function ShopifyIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#96bf48" />
      <path d="M15.5 6.5c-.1-.1-.3-.1-.5-.1s-.3 0-.5.1c-.1-.4-.4-1.2-1.2-1.2-.1 0-.1 0-.2.1-.3-.4-.7-.6-1.1-.6-2.7 0-4 3.4-4.4 5.1l-1.6.5v8.2l7.5 1.3 4-1V7.2L15.5 6.5zm-2.2-.8c.5 0 .8.5.9.9-.4.1-.9.3-1.4.4 0-.5.2-1.3.5-1.3zM12 19.5 8 18.7V10l4 .7v8.8zm1 .2v-8.8l3-1.1v9.5l-3 .4zm2.9-9.9-3 1.1-.9-.1.1-3.3.3-.1.3.1-.1 2.8 1.8-.6.2.1h1.3z" fill="#fff" />
    </svg>
  );
}

const PLATFORMS: PlatformCard[] = [
  {
    name: "WordPress",
    description: "Publish to any WordPress site via REST API",
    icon: <WordPressIcon />,
  },
  {
    name: "Medium",
    description: "Reach millions of readers on Medium",
    icon: <MediumIcon />,
  },
  {
    name: "Dev.to",
    description: "Share articles with the developer community",
    icon: <DevToIcon />,
  },
  {
    name: "Ghost",
    description: "Publish to your Ghost-powered publication",
    icon: <GhostIcon />,
  },
  {
    name: "Shopify",
    description: "Drive traffic to your Shopify store blog",
    icon: <ShopifyIcon />,
  },
];

// ─── Shared style helpers ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border-default, var(--card-border, #e2e8f0))",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  border: "1px solid #ef4444",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--foreground)",
  marginBottom: "6px",
};

const optionalBadgeStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 400,
  color: "var(--muted, #94a3b8)",
  marginLeft: "6px",
};

const primaryBtnStyle = (loading: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  background: "var(--accent, #3b82f6)",
  color: "#fff",
  border: "none",
  fontSize: "15px",
  fontWeight: 600,
  cursor: loading ? "not-allowed" : "pointer",
  opacity: loading ? 0.65 : 1,
  transition: "opacity 0.15s",
  fontFamily: "inherit",
});

const ghostBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border-default, var(--card-border, #e2e8f0))",
  color: "var(--foreground)",
  padding: "11px 20px",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};

const inlineErrorStyle: React.CSSProperties = {
  color: "#ef4444",
  fontSize: "12px",
  marginTop: "4px",
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  // Step state
  const [step, setStep] = useState(1);

  // Step 2 – Site Setup
  const [domain, setDomain] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteAbout, setSiteAbout] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ domain?: string; site_name?: string }>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  // Step 3 – Platform Connect
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  // ── Auth guard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  // ── Check if already onboarded ────────────────────────────────────────────────
  useEffect(() => {
    if (!authChecked) return;
    fetch("/api/onboarding/status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.onboarding_complete === true) router.replace("/app");
      })
      .catch(() => {/* ignore */});
  }, [authChecked, router]);

  // ── Step 2: save settings ─────────────────────────────────────────────────────
  async function handleSaveSettings() {
    const errors: { domain?: string; site_name?: string } = {};
    if (!domain.trim()) errors.domain = "Domain is required.";
    if (!siteName.trim()) errors.site_name = "Site name is required.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaveError("");
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          site_name: siteName.trim(),
          site_about: siteAbout.trim() || undefined,
          author_name: authorName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || "Failed to save settings. Please try again.");
        return;
      }
      setStep(3);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Step 3: complete onboarding ───────────────────────────────────────────────
  async function handleComplete() {
    setCompleteError("");
    setCompleting(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCompleteError(data.error || "Something went wrong. Please try again.");
        return;
      }
      router.push("/app");
    } catch {
      setCompleteError("Network error. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  // ── Render guard ──────────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "3px solid var(--border-default, #e2e8f0)",
            borderTopColor: "var(--accent, #3b82f6)",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--background, #f8fafc)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: "520px" }}>

        {/* ── Brand ─────────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "32px",
          }}
        >
          {/* Blue icon */}
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9px",
              background: "var(--accent, #3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6h16M4 10h10M4 14h12M4 18h8"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--foreground)",
              letterSpacing: "-0.3px",
            }}
          >
            ArticleGen
          </span>
        </div>

        {/* ── Progress indicator ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            marginBottom: "28px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--muted, #94a3b8)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Step {step} of {TOTAL_STEPS}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              const dotStep = i + 1;
              const isActive = dotStep === step;
              const isCompleted = dotStep < step;
              return (
                <div
                  key={dotStep}
                  style={{
                    width: isActive ? "28px" : "10px",
                    height: "10px",
                    borderRadius: "5px",
                    background: isActive || isCompleted
                      ? "var(--accent, #3b82f6)"
                      : "var(--border-default, var(--card-border, #e2e8f0))",
                    transition: "width 0.25s ease, background 0.2s",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* ── Card ──────────────────────────────────────────────────────────────── */}
        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border-default, var(--card-border, #e2e8f0))",
            borderRadius: "14px",
            padding: "40px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          }}
        >

          {/* ════════════════════════════════════════════════════════════════════
              STEP 1 – WELCOME
          ════════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div>
              {/* Hero icon */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "18px",
                    background: "linear-gradient(135deg, var(--accent, #3b82f6) 0%, #6366f1 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 24px rgba(59,130,246,0.3)",
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <h1
                style={{
                  margin: "0 0 10px",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "var(--foreground)",
                  textAlign: "center",
                  letterSpacing: "-0.4px",
                }}
              >
                Welcome to ArticleGen
              </h1>
              <p
                style={{
                  margin: "0 0 28px",
                  color: "var(--muted, #64748b)",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  textAlign: "center",
                }}
              >
                Generate SEO-optimized articles in seconds using AI. Publish directly
                to WordPress, Medium, Ghost, and more — all from one place.
              </p>

              {/* Benefits */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "32px",
                }}
              >
                {[
                  {
                    icon: "✦",
                    title: "AI-powered writing",
                    desc: "High-quality, long-form articles generated in under a minute",
                  },
                  {
                    icon: "✦",
                    title: "One-click publishing",
                    desc: "Connect your platforms and publish without leaving the dashboard",
                  },
                  {
                    icon: "✦",
                    title: "SEO optimised",
                    desc: "Every article is crafted to rank — headings, meta, and structure included",
                  },
                ].map((b) => (
                  <div
                    key={b.title}
                    style={{
                      display: "flex",
                      gap: "12px",
                      padding: "14px",
                      borderRadius: "10px",
                      background: "var(--background, #f8fafc)",
                      border: "1px solid var(--border-default, var(--card-border, #e2e8f0))",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--accent, #3b82f6)",
                        fontSize: "16px",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      {b.icon}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--foreground)",
                          marginBottom: "2px",
                        }}
                      >
                        {b.title}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                        {b.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                style={primaryBtnStyle(false)}
              >
                Get started →
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STEP 2 – SITE SETUP
          ════════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div>
              <h1
                style={{
                  margin: "0 0 6px",
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "var(--foreground)",
                  letterSpacing: "-0.3px",
                }}
              >
                Set up your site
              </h1>
              <p
                style={{
                  margin: "0 0 24px",
                  color: "var(--muted, #64748b)",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                Tell us about your website so we can tailor content for you.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

                {/* Domain (required) */}
                <div>
                  <label style={labelStyle}>
                    Domain
                    <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => {
                      setDomain(e.target.value);
                      if (fieldErrors.domain) setFieldErrors((p) => ({ ...p, domain: undefined }));
                    }}
                    placeholder="yourblog.com"
                    style={fieldErrors.domain ? inputErrorStyle : inputStyle}
                    aria-describedby={fieldErrors.domain ? "domain-error" : undefined}
                  />
                  {fieldErrors.domain && (
                    <p id="domain-error" style={inlineErrorStyle}>{fieldErrors.domain}</p>
                  )}
                </div>

                {/* Site name (required) */}
                <div>
                  <label style={labelStyle}>
                    Site name
                    <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => {
                      setSiteName(e.target.value);
                      if (fieldErrors.site_name) setFieldErrors((p) => ({ ...p, site_name: undefined }));
                    }}
                    placeholder="My Awesome Blog"
                    style={fieldErrors.site_name ? inputErrorStyle : inputStyle}
                    aria-describedby={fieldErrors.site_name ? "sitename-error" : undefined}
                  />
                  {fieldErrors.site_name && (
                    <p id="sitename-error" style={inlineErrorStyle}>{fieldErrors.site_name}</p>
                  )}
                </div>

                {/* Site about (optional) */}
                <div>
                  <label style={labelStyle}>
                    What is your site about?
                    <span style={optionalBadgeStyle}>optional</span>
                  </label>
                  <textarea
                    value={siteAbout}
                    onChange={(e) => setSiteAbout(e.target.value)}
                    placeholder="A blog about technology, productivity, and modern life..."
                    rows={3}
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      minHeight: "80px",
                    }}
                  />
                </div>

                {/* Author name (optional) */}
                <div>
                  <label style={labelStyle}>
                    Author name
                    <span style={optionalBadgeStyle}>optional</span>
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Jane Smith"
                    style={inputStyle}
                  />
                </div>
              </div>

              {saveError && (
                <p style={{ ...inlineErrorStyle, marginTop: "14px", fontSize: "13px" }}>
                  {saveError}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px", marginTop: "28px" }}>
                <button
                  onClick={() => setStep(1)}
                  style={{ ...ghostBtnStyle, flexShrink: 0 }}
                  disabled={saving}
                >
                  ← Back
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  style={{ ...primaryBtnStyle(saving), flex: 1 }}
                >
                  {saving ? "Saving…" : "Save & continue →"}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STEP 3 – PLATFORM CONNECT
          ════════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div>
              <h1
                style={{
                  margin: "0 0 6px",
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "var(--foreground)",
                  letterSpacing: "-0.3px",
                }}
              >
                Connect a platform
              </h1>
              <p
                style={{
                  margin: "0 0 24px",
                  color: "var(--muted, #64748b)",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                Connect a publishing platform to start sending articles directly from
                ArticleGen. You can always do this later in Settings.
              </p>

              {/* Platform cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {PLATFORMS.map((p) => (
                  <div
                    key={p.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: "1px solid var(--border-default, var(--card-border, #e2e8f0))",
                      background: "var(--background, #f8fafc)",
                    }}
                  >
                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                      {p.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--foreground)",
                          marginBottom: "2px",
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--muted, #94a3b8)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.description}
                      </div>
                    </div>
                    <a
                      href="/app/settings"
                      style={{
                        flexShrink: 0,
                        padding: "7px 14px",
                        borderRadius: "7px",
                        border: "1px solid var(--border-default, var(--card-border, #e2e8f0))",
                        background: "var(--card, #fff)",
                        color: "var(--foreground)",
                        fontSize: "13px",
                        fontWeight: 500,
                        textDecoration: "none",
                        display: "inline-block",
                        transition: "border-color 0.15s",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent, #3b82f6)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-default, var(--card-border, #e2e8f0))";
                      }}
                    >
                      Connect
                    </a>
                  </div>
                ))}
              </div>

              {completeError && (
                <p style={{ ...inlineErrorStyle, fontSize: "13px", marginBottom: "14px" }}>
                  {completeError}
                </p>
              )}

              {/* Primary CTA */}
              <button
                onClick={handleComplete}
                disabled={completing}
                style={primaryBtnStyle(completing)}
              >
                {completing ? "Just a moment…" : "Finish setup →"}
              </button>

              {/* Skip */}
              <div style={{ textAlign: "center", marginTop: "14px" }}>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted, #94a3b8)",
                    fontSize: "13px",
                    cursor: completing ? "not-allowed" : "pointer",
                    padding: "4px 8px",
                    textDecoration: "underline",
                    fontFamily: "inherit",
                  }}
                >
                  Skip for now
                </button>
              </div>

              {/* Back link */}
              <div style={{ textAlign: "center", marginTop: "6px" }}>
                <button
                  onClick={() => setStep(2)}
                  disabled={completing}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted, #94a3b8)",
                    fontSize: "13px",
                    cursor: completing ? "not-allowed" : "pointer",
                    padding: "4px 8px",
                    fontFamily: "inherit",
                  }}
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer note ──────────────────────────────────────────────────────── */}
        <p
          style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "12px",
            color: "var(--muted, #94a3b8)",
          }}
        >
          You can update these settings at any time in{" "}
          <a
            href="/app/settings"
            style={{ color: "var(--accent, #3b82f6)", textDecoration: "none" }}
          >
            Settings
          </a>
          .
        </p>

      </div>
    </div>
  );
}
