"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

interface WpBlog {
  id: string;
  name: string;
  url: string;
  username: string;
  appPassword: string;
  authorName: string;
  authorAbout: string;
}

interface ShopifyAccount {
  id: string;
  name: string;
  shopDomain: string;
  accessToken: string;
}

interface MediumAccount {
  id: string;
  name: string;
  integrationToken: string;
}

interface GhostBlog {
  id: string;
  name: string;
  url: string;
  adminApiKey: string;
}

interface DevToAccount {
  id: string;
  name: string;
  apiKey: string;
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "8px 36px 8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {show ? (
            <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
          ) : (
            <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
          )}
        </svg>
      </button>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" } as const;
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 } as const;
const cardStyle = { background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, overflow: "hidden" } as const;
const sectionHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--card-border)" } as const;

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // WordPress
  const [blogs, setBlogs] = useState<WpBlog[]>([]);
  const [testingBlogId, setTestingBlogId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  // Shopify
  const [shopifyAccounts, setShopifyAccounts] = useState<ShopifyAccount[]>([]);

  // Medium
  const [mediumAccounts, setMediumAccounts] = useState<MediumAccount[]>([]);

  // Ghost
  const [ghostBlogs, setGhostBlogs] = useState<GhostBlog[]>([]);

  // Dev.to
  const [devtoAccounts, setDevtoAccounts] = useState<DevToAccount[]>([]);

  // Platform connection tests (shared across all non-WP platforms)
  const [testingPlatformId, setTestingPlatformId] = useState<string | null>(null);
  const [platformTestResults, setPlatformTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  // Site settings
  const [domain, setDomain] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteAbout, setSiteAbout] = useState("");

  const fetchSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/?auth=login"); return; }

    const res = await fetch("/api/settings");
    if (!res.ok) { setLoading(false); return; }
    const { settings } = await res.json();

    if (settings) {
      setDomain(settings.domain || "");
      setSiteName(settings.site_name || "");
      setSiteAbout(settings.site_about || "");

      if (Array.isArray(settings.wp_blogs) && settings.wp_blogs.length > 0) {
        setBlogs(settings.wp_blogs);
      } else if (settings.wp_url) {
        setBlogs([{
          id: crypto.randomUUID(),
          name: new URL(settings.wp_url).hostname.replace("www.", ""),
          url: settings.wp_url,
          username: settings.wp_username || "",
          appPassword: settings.wp_app_password || "",
          authorName: settings.author_name || "",
          authorAbout: settings.author_about || "",
        }]);
      }

      if (Array.isArray(settings.shopify_accounts)) setShopifyAccounts(settings.shopify_accounts);
      if (Array.isArray(settings.medium_accounts)) setMediumAccounts(settings.medium_accounts);
      if (Array.isArray(settings.ghost_blogs)) setGhostBlogs(settings.ghost_blogs);
      if (Array.isArray(settings.devto_accounts)) setDevtoAccounts(settings.devto_accounts);
    }
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          site_name: siteName,
          site_about: siteAbout,
          wp_blogs: blogs.filter((b) => b.url.trim()),
          shopify_accounts: shopifyAccounts.filter((a) => a.shopDomain.trim()),
          medium_accounts: mediumAccounts.filter((a) => a.integrationToken.trim()),
          ghost_blogs: ghostBlogs.filter((b) => b.url.trim()),
          devto_accounts: devtoAccounts.filter((a) => a.apiKey.trim()),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveMessage(`Failed to save: ${data.error || res.status}`);
      } else {
        setSaveMessage("Settings saved");
        setTimeout(() => setSaveMessage(""), 2500);
      }
    } catch (err) {
      setSaveMessage(`Failed to save: ${err instanceof Error ? err.message : "unexpected error"}`);
    } finally {
      setSaving(false);
    }
  };

  // ── WordPress helpers ──────────────────────────────────────────────────────

  const addBlog = () => {
    if (blogs.length >= 3) return;
    setBlogs((prev) => [...prev, { id: crypto.randomUUID(), name: "", url: "", username: "", appPassword: "", authorName: "", authorAbout: "" }]);
  };
  const removeBlog = (id: string) => {
    setBlogs((prev) => prev.filter((b) => b.id !== id));
    setTestResults((prev) => { const next = { ...prev }; delete next[id]; return next; });
  };
  const updateBlog = (id: string, field: keyof WpBlog, value: string) => {
    setBlogs((prev) => prev.map((b) => b.id === id ? { ...b, [field]: value } : b));
    if (testResults[id]) setTestResults((prev) => { const next = { ...prev }; delete next[id]; return next; });
  };
  const testConnection = async (blog: WpBlog) => {
    setTestingBlogId(blog.id);
    setTestResults((prev) => ({ ...prev, [blog.id]: { ok: false, message: "Testing..." } }));
    try {
      const wpUrl = blog.url.replace(/\/$/, "");
      const auth = btoa(`${blog.username}:${blog.appPassword}`);
      const res = await fetch(`${wpUrl}/wp-json/wp/v2/categories?per_page=1`, { headers: { Authorization: `Basic ${auth}` } });
      if (res.ok) {
        setTestResults((prev) => ({ ...prev, [blog.id]: { ok: true, message: "Connected!" } }));
      } else if (res.status === 401 || res.status === 403) {
        setTestResults((prev) => ({ ...prev, [blog.id]: { ok: false, message: "Authentication failed." } }));
      } else {
        setTestResults((prev) => ({ ...prev, [blog.id]: { ok: false, message: `Error: ${res.status}` } }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [blog.id]: { ok: false, message: "Could not connect. Check the URL." } }));
    }
    setTestingBlogId(null);
  };

  // ── Shopify helpers ────────────────────────────────────────────────────────

  const addShopify = () => setShopifyAccounts((prev) => [...prev, { id: crypto.randomUUID(), name: "", shopDomain: "", accessToken: "" }]);
  const removeShopify = (id: string) => setShopifyAccounts((prev) => prev.filter((a) => a.id !== id));
  const updateShopify = (id: string, field: keyof ShopifyAccount, value: string) =>
    setShopifyAccounts((prev) => prev.map((a) => a.id === id ? { ...a, [field]: value } : a));

  // ── Medium helpers ─────────────────────────────────────────────────────────

  const addMedium = () => setMediumAccounts((prev) => [...prev, { id: crypto.randomUUID(), name: "", integrationToken: "" }]);
  const removeMedium = (id: string) => setMediumAccounts((prev) => prev.filter((a) => a.id !== id));
  const updateMedium = (id: string, field: keyof MediumAccount, value: string) =>
    setMediumAccounts((prev) => prev.map((a) => a.id === id ? { ...a, [field]: value } : a));

  // ── Ghost helpers ──────────────────────────────────────────────────────────

  const addGhost = () => setGhostBlogs((prev) => [...prev, { id: crypto.randomUUID(), name: "", url: "", adminApiKey: "" }]);
  const removeGhost = (id: string) => setGhostBlogs((prev) => prev.filter((b) => b.id !== id));
  const updateGhost = (id: string, field: keyof GhostBlog, value: string) =>
    setGhostBlogs((prev) => prev.map((b) => b.id === id ? { ...b, [field]: value } : b));

  // ── Dev.to helpers ─────────────────────────────────────────────────────────

  const addDevTo = () => setDevtoAccounts((prev) => [...prev, { id: crypto.randomUUID(), name: "", apiKey: "" }]);
  const removeDevTo = (id: string) => setDevtoAccounts((prev) => prev.filter((a) => a.id !== id));
  const updateDevTo = (id: string, field: keyof DevToAccount, value: string) =>
    setDevtoAccounts((prev) => prev.map((a) => a.id === id ? { ...a, [field]: value } : a));

  const testPlatformConnection = async (id: string, endpoint: string, body: Record<string, string>) => {
    setTestingPlatformId(id);
    setPlatformTestResults((prev) => ({ ...prev, [id]: { ok: false, message: "Testing..." } }));
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      setPlatformTestResults((prev) => ({ ...prev, [id]: { ok: data.ok === true, message: data.message || (data.ok ? "Connected" : "Failed") } }));
    } catch {
      setPlatformTestResults((prev) => ({ ...prev, [id]: { ok: false, message: "Network error" } }));
    } finally {
      setTestingPlatformId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--background)" }}>
        <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid var(--card-border)", background: "var(--background)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }} onClick={() => router.push("/app")}>
              <Image src="/logo.png" alt="Article Sauce" width={28} height={28} />
              <span style={{ fontWeight: 700, fontSize: 17 }}>Article Sauce</span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>/</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Settings</span>
          </div>
          <button onClick={() => router.push("/app")} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "var(--card)", border: "1px solid var(--card-border)", cursor: "pointer" }}>
            Back to App
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>

        {/* WordPress */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>WordPress</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Connect up to 3 WordPress sites. Articles won&apos;t auto-publish — you choose when.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {blogs.map((blog, idx) => (
              <div key={blog.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{idx + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{blog.name || `Blog ${idx + 1}`}</span>
                    {testResults[blog.id] && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: testResults[blog.id].ok ? "var(--success)" : "var(--error)", marginLeft: 4 }}>
                        {testResults[blog.id].message}
                      </span>
                    )}
                  </div>
                  <button onClick={() => removeBlog(blog.id)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
                    Remove
                  </button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Blog Name</label><input type="text" value={blog.name} onChange={(e) => updateBlog(blog.id, "name", e.target.value)} placeholder="My Blog" style={inputStyle} /></div>
                    <div><label style={labelStyle}>WordPress URL</label><input type="text" value={blog.url} onChange={(e) => updateBlog(blog.id, "url", e.target.value)} placeholder="https://yourblog.com" style={inputStyle} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Username</label><input type="text" value={blog.username} onChange={(e) => updateBlog(blog.id, "username", e.target.value)} placeholder="admin" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Application Password</label><PasswordInput value={blog.appPassword} onChange={(v) => updateBlog(blog.id, "appPassword", v)} placeholder="xxxx xxxx xxxx xxxx" /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Author Name</label><input type="text" value={blog.authorName || ""} onChange={(e) => updateBlog(blog.id, "authorName", e.target.value)} placeholder="John Doe" style={inputStyle} /></div>
                    <div><label style={labelStyle}>About the Author</label><input type="text" value={blog.authorAbout || ""} onChange={(e) => updateBlog(blog.id, "authorAbout", e.target.value)} placeholder="Expert with 10 years of experience" style={inputStyle} /></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>WordPress › Users › Profile › Application Passwords</p>
                    <button onClick={() => testConnection(blog)} disabled={!blog.url || !blog.username || !blog.appPassword || testingBlogId === blog.id}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--background)", border: "1px solid var(--card-border)", cursor: "pointer", opacity: (!blog.url || !blog.username || !blog.appPassword) ? 0.4 : 1 }}>
                      {testingBlogId === blog.id ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {blogs.length < 3 && (
              <button onClick={addBlog}
                style={{ padding: 14, borderRadius: 12, border: "2px dashed var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add WordPress Blog ({blogs.length}/3)
              </button>
            )}
          </div>
        </section>

        {/* Shopify */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Shopify</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Publish articles to your Shopify blog. Requires a Private App with <code>write_content</code> permission.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {shopifyAccounts.map((account) => (
              <div key={account.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{account.name || account.shopDomain || "Shopify Store"}</span>
                  <button onClick={() => removeShopify(account.id)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>Remove</button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Account Name</label><input type="text" value={account.name} onChange={(e) => updateShopify(account.id, "name", e.target.value)} placeholder="My Store" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Shop Domain</label><input type="text" value={account.shopDomain} onChange={(e) => updateShopify(account.id, "shopDomain", e.target.value)} placeholder="mystore.myshopify.com" style={inputStyle} /></div>
                  </div>
                  <div><label style={labelStyle}>Access Token</label><PasswordInput value={account.accessToken} onChange={(v) => updateShopify(account.id, "accessToken", v)} placeholder="shpat_..." /></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>Shopify Admin › Apps › Develop apps › Create a private app</p>
                    <button onClick={() => testPlatformConnection(account.id, "/api/shopify/test", { accountId: account.id })} disabled={!account.shopDomain || !account.accessToken || testingPlatformId === account.id}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--background)", border: "1px solid var(--card-border)", cursor: "pointer", opacity: (!account.shopDomain || !account.accessToken) ? 0.4 : 1, whiteSpace: "nowrap" }}>
                      {testingPlatformId === account.id ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                  {platformTestResults[account.id] && (
                    <p style={{ fontSize: 12, color: platformTestResults[account.id].ok ? "var(--success)" : "var(--error)", margin: 0 }}>
                      {platformTestResults[account.id].message}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addShopify}
              style={{ padding: 14, borderRadius: 12, border: "2px dashed var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Shopify Store
            </button>
          </div>
        </section>

        {/* Medium */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Medium</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Publish articles to Medium using an Integration Token.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {mediumAccounts.map((account) => (
              <div key={account.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{account.name || "Medium Account"}</span>
                  <button onClick={() => removeMedium(account.id)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>Remove</button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div><label style={labelStyle}>Account Name</label><input type="text" value={account.name} onChange={(e) => updateMedium(account.id, "name", e.target.value)} placeholder="My Medium Account" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Integration Token</label><PasswordInput value={account.integrationToken} onChange={(v) => updateMedium(account.id, "integrationToken", v)} placeholder="Your Medium integration token" /></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>medium.com › Settings › Security and apps › Integration tokens</p>
                    <button onClick={() => testPlatformConnection(account.id, "/api/medium/test", { accountId: account.id })} disabled={!account.integrationToken || testingPlatformId === account.id}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--background)", border: "1px solid var(--card-border)", cursor: "pointer", opacity: !account.integrationToken ? 0.4 : 1, whiteSpace: "nowrap" }}>
                      {testingPlatformId === account.id ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                  {platformTestResults[account.id] && (
                    <p style={{ fontSize: 12, color: platformTestResults[account.id].ok ? "var(--success)" : "var(--error)", margin: 0 }}>
                      {platformTestResults[account.id].message}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addMedium}
              style={{ padding: 14, borderRadius: 12, border: "2px dashed var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Medium Account
            </button>
          </div>
        </section>

        {/* Ghost */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Ghost</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Publish to a self-hosted or Ghost(Pro) site using the Admin API.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {ghostBlogs.map((blog) => (
              <div key={blog.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{blog.name || blog.url || "Ghost Blog"}</span>
                  <button onClick={() => removeGhost(blog.id)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>Remove</button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Site Name</label><input type="text" value={blog.name} onChange={(e) => updateGhost(blog.id, "name", e.target.value)} placeholder="My Ghost Blog" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Ghost URL</label><input type="text" value={blog.url} onChange={(e) => updateGhost(blog.id, "url", e.target.value)} placeholder="https://yourblog.ghost.io" style={inputStyle} /></div>
                  </div>
                  <div><label style={labelStyle}>Admin API Key</label><PasswordInput value={blog.adminApiKey} onChange={(v) => updateGhost(blog.id, "adminApiKey", v)} placeholder="id:secret (from Ghost Admin › Integrations)" /></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>Ghost Admin › Settings › Integrations › Add custom integration</p>
                    <button onClick={() => testPlatformConnection(blog.id, "/api/ghost/test", { blogId: blog.id })} disabled={!blog.url || !blog.adminApiKey || testingPlatformId === blog.id}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--background)", border: "1px solid var(--card-border)", cursor: "pointer", opacity: (!blog.url || !blog.adminApiKey) ? 0.4 : 1, whiteSpace: "nowrap" }}>
                      {testingPlatformId === blog.id ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                  {platformTestResults[blog.id] && (
                    <p style={{ fontSize: 12, color: platformTestResults[blog.id].ok ? "var(--success)" : "var(--error)", margin: 0 }}>
                      {platformTestResults[blog.id].message}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addGhost}
              style={{ padding: 14, borderRadius: 12, border: "2px dashed var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Ghost Blog
            </button>
          </div>
        </section>

        {/* Dev.to */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Dev.to</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Publish articles to dev.to using your API key.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {devtoAccounts.map((account) => (
              <div key={account.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{account.name || "Dev.to Account"}</span>
                  <button onClick={() => removeDevTo(account.id)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>Remove</button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div><label style={labelStyle}>Account Name</label><input type="text" value={account.name} onChange={(e) => updateDevTo(account.id, "name", e.target.value)} placeholder="My Dev.to Account" style={inputStyle} /></div>
                  <div><label style={labelStyle}>API Key</label><PasswordInput value={account.apiKey} onChange={(v) => updateDevTo(account.id, "apiKey", v)} placeholder="Your Dev.to API key" /></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>dev.to › Settings › Extensions › DEV API Keys</p>
                    <button onClick={() => testPlatformConnection(account.id, "/api/devto/test", { accountId: account.id })} disabled={!account.apiKey || testingPlatformId === account.id}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--background)", border: "1px solid var(--card-border)", cursor: "pointer", opacity: !account.apiKey ? 0.4 : 1, whiteSpace: "nowrap" }}>
                      {testingPlatformId === account.id ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                  {platformTestResults[account.id] && (
                    <p style={{ fontSize: 12, color: platformTestResults[account.id].ok ? "var(--success)" : "var(--error)", margin: 0 }}>
                      {platformTestResults[account.id].message}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addDevTo}
              style={{ padding: 14, borderRadius: 12, border: "2px dashed var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Dev.to Account
            </button>
          </div>
        </section>

        {/* Site Settings */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Site Settings</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Used to personalize generated articles with your brand.</p>
          <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {([
              { label: "Domain", value: domain, set: setDomain, placeholder: "https://yourblog.com" },
              { label: "Site Name", value: siteName, set: setSiteName, placeholder: "Your Blog Name" },
              { label: "About the Blog", value: siteAbout, set: setSiteAbout, placeholder: "A blog about sustainable living and eco-friendly tips" },
            ] as { label: string; value: string; set: (v: string) => void; placeholder: string }[]).map((field) => (
              <div key={field.label}>
                <label style={labelStyle}>{field.label}</label>
                <input type="text" value={field.value} onChange={(e) => field.set(e.target.value)} placeholder={field.placeholder} style={inputStyle} />
              </div>
            ))}
          </div>
        </section>

        {/* Save */}
        <div style={{ position: "sticky", bottom: 0, padding: "16px 0", background: "var(--background)", borderTop: "1px solid var(--card-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: saveMessage === "Settings saved" ? "var(--success)" : "var(--error)" }}>
              {saveMessage}
            </span>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "10px 28px", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
