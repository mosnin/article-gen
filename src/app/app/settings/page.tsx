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

interface NotionConnection {
  id: string;
  name: string;
  databaseId: string;
  integrationToken: string;
}

interface WebflowSite {
  id: string;
  name: string;
  siteId: string;
  collectionId: string;
  apiToken: string;
}

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  format: "json" | "html" | "markdown";
}

interface Preset {
  id: string;
  name: string;
  quality: "standard" | "premium";
  wordCount: number;
  withImages: boolean;
  tone: string;
  targetAudience: string;
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

  // Notion
  const [notionConnections, setNotionConnections] = useState<NotionConnection[]>([]);

  // Webflow
  const [webflowSites, setWebflowSites] = useState<WebflowSite[]>([]);

  // Webhooks
  const [webhookEndpoints, setWebhookEndpoints] = useState<WebhookEndpoint[]>([]);

  // Platform connection tests (shared across all non-WP platforms)
  const [testingPlatformId, setTestingPlatformId] = useState<string | null>(null);
  const [platformTestResults, setPlatformTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  // Presets
  const [presets, setPresets] = useState<Preset[]>([]);

  // Google Search Console
  const [gscConnected, setGscConnected] = useState(false);
  const [gscSiteUrl, setGscSiteUrl] = useState("");
  const [gscSites, setGscSites] = useState<Array<{ siteUrl: string; permissionLevel: string }>>([]);
  const [gscLoadingSites, setGscLoadingSites] = useState(false);
  const [gscMessage, setGscMessage] = useState("");

  // Site settings
  const [domain, setDomain] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteAbout, setSiteAbout] = useState("");

  // MCP
  const [mcpApiKey, setMcpApiKey] = useState<string | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpSetupOpen, setMcpSetupOpen] = useState(false);

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
      if (Array.isArray(settings.notion_connections)) setNotionConnections(settings.notion_connections);
      if (Array.isArray(settings.webflow_sites)) setWebflowSites(settings.webflow_sites);
      if (Array.isArray(settings.webhook_endpoints)) setWebhookEndpoints(settings.webhook_endpoints);
      if (Array.isArray(settings.presets)) setPresets(settings.presets);
      setGscConnected(!!settings.gsc_connected);
      setGscSiteUrl(settings.gsc_site_url || "");
    }

    // Check for GSC connection result from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("gsc_connected") === "1") {
      setGscConnected(true);
      setGscMessage("Google Search Console connected!");
      window.history.replaceState({}, "", "/app/settings");
    } else if (params.get("gsc_error")) {
      setGscMessage(`GSC connection failed: ${params.get("gsc_error")}`);
      window.history.replaceState({}, "", "/app/settings");
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  useEffect(() => {
    fetch("/api/mcp/key")
      .then((r) => r.json())
      .then((data: { apiKey?: string | null }) => setMcpApiKey(data.apiKey ?? null))
      .catch(() => {});
  }, []);

  const generateMcpKey = async () => {
    setMcpLoading(true);
    try {
      const res = await fetch("/api/mcp/key", { method: "POST" });
      const data = await res.json() as { apiKey?: string };
      if (data.apiKey) {
        setMcpApiKey(data.apiKey);
      }
    } catch { /* ignore */ }
    finally { setMcpLoading(false); }
  };

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
          notion_connections: notionConnections.filter((c) => c.databaseId.trim()),
          webflow_sites: webflowSites.filter((s) => s.collectionId.trim()),
          webhook_endpoints: webhookEndpoints.filter((w) => w.url.trim()),
          presets: presets.filter((p) => p.name.trim()),
          gsc_site_url: gscSiteUrl,
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

  // ── Notion helpers ─────────────────────────────────────────────────────────
  const addNotion = () => setNotionConnections((prev) => [...prev, { id: crypto.randomUUID(), name: "", databaseId: "", integrationToken: "" }]);
  const removeNotion = (id: string) => setNotionConnections((prev) => prev.filter((c) => c.id !== id));
  const updateNotion = (id: string, field: keyof NotionConnection, value: string) =>
    setNotionConnections((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));

  // ── Webflow helpers ─────────────────────────────────────────────────────────
  const addWebflow = () => setWebflowSites((prev) => [...prev, { id: crypto.randomUUID(), name: "", siteId: "", collectionId: "", apiToken: "" }]);
  const removeWebflow = (id: string) => setWebflowSites((prev) => prev.filter((s) => s.id !== id));
  const updateWebflow = (id: string, field: keyof WebflowSite, value: string) =>
    setWebflowSites((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));

  // ── Webhook helpers ─────────────────────────────────────────────────────────
  const addWebhook = () => setWebhookEndpoints((prev) => [...prev, { id: crypto.randomUUID(), name: "", url: "", secret: "", format: "json" }]);
  const removeWebhook = (id: string) => setWebhookEndpoints((prev) => prev.filter((w) => w.id !== id));
  const updateWebhook = (id: string, field: keyof WebhookEndpoint, value: string) =>
    setWebhookEndpoints((prev) => prev.map((w) => w.id === id ? { ...w, [field]: value } : w));

  // ── Preset helpers ──────────────────────────────────────────────────────
  const addPreset = () => setPresets((prev) => [...prev, {
    id: crypto.randomUUID(), name: "", quality: "premium", wordCount: 2000, withImages: false, tone: "professional", targetAudience: "",
  }]);
  const removePreset = (id: string) => setPresets((prev) => prev.filter((p) => p.id !== id));
  const updatePreset = (id: string, field: keyof Preset, value: string | number | boolean) =>
    setPresets((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p));

  // ── GSC helpers ─────────────────────────────────────────────────────────
  const fetchGscSites = async () => {
    setGscLoadingSites(true);
    setGscMessage("");
    try {
      const res = await fetch("/api/gsc/sites");
      const data = await res.json() as { sites?: Array<{ siteUrl: string; permissionLevel: string }>; error?: string };
      if (data.error) { setGscMessage(data.error); }
      else { setGscSites(data.sites ?? []); }
    } catch { setGscMessage("Failed to load sites"); }
    finally { setGscLoadingSites(false); }
  };
  const disconnectGsc = async () => {
    await fetch("/api/gsc/disconnect", { method: "POST" });
    setGscConnected(false);
    setGscSiteUrl("");
    setGscSites([]);
    setGscMessage("Disconnected from Google Search Console");
  };

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

        {/* Notion */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Notion</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Publish articles directly to a Notion database. Requires an integration token and database ID.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {notionConnections.map((conn) => (
              <div key={conn.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{conn.name || "Notion Database"}</span>
                  <button onClick={() => removeNotion(conn.id)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>Remove</button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Connection Name</label><input type="text" value={conn.name} onChange={(e) => updateNotion(conn.id, "name", e.target.value)} placeholder="My Notion DB" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Database ID</label><input type="text" value={conn.databaseId} onChange={(e) => updateNotion(conn.id, "databaseId", e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" style={inputStyle} /></div>
                  </div>
                  <div><label style={labelStyle}>Integration Token</label><PasswordInput value={conn.integrationToken} onChange={(v) => updateNotion(conn.id, "integrationToken", v)} placeholder="secret_..." /></div>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
                    Notion Settings → Integrations → New integration. Database must have: Name (title), Content, Meta Description, Slug, Focus Keyword, Status (select).
                  </p>
                </div>
              </div>
            ))}
            <button onClick={addNotion}
              style={{ padding: 14, borderRadius: 12, border: "2px dashed var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Notion Connection
            </button>
          </div>
        </section>

        {/* Webflow */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Webflow</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Publish articles to a Webflow CMS collection. Requires an API token and Collection ID.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {webflowSites.map((site) => (
              <div key={site.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{site.name || "Webflow Site"}</span>
                  <button onClick={() => removeWebflow(site.id)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>Remove</button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Site Name</label><input type="text" value={site.name} onChange={(e) => updateWebflow(site.id, "name", e.target.value)} placeholder="My Webflow Site" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Site ID</label><input type="text" value={site.siteId} onChange={(e) => updateWebflow(site.id, "siteId", e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" style={inputStyle} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Collection ID</label><input type="text" value={site.collectionId} onChange={(e) => updateWebflow(site.id, "collectionId", e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" style={inputStyle} /></div>
                    <div><label style={labelStyle}>API Token</label><PasswordInput value={site.apiToken} onChange={(v) => updateWebflow(site.id, "apiToken", v)} placeholder="..." /></div>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
                    Webflow Dashboard → Site Settings → Integrations → API Access. Collection must have fields: name, slug, post-body, post-summary, meta-title, meta-description.
                  </p>
                </div>
              </div>
            ))}
            <button onClick={addWebflow}
              style={{ padding: 14, borderRadius: 12, border: "2px dashed var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Webflow Site
            </button>
          </div>
        </section>

        {/* Webhooks */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Webhooks</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Send articles to any endpoint when published. Supports JSON, HTML, or Markdown. Optional HMAC-SHA256 signing.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {webhookEndpoints.map((wh) => (
              <div key={wh.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{wh.name || wh.url || "Webhook"}</span>
                  <button onClick={() => removeWebhook(wh.id)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>Remove</button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Name</label><input type="text" value={wh.name} onChange={(e) => updateWebhook(wh.id, "name", e.target.value)} placeholder="My CMS" style={inputStyle} /></div>
                    <div>
                      <label style={labelStyle}>Content Format</label>
                      <select value={wh.format} onChange={(e) => updateWebhook(wh.id, "format", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                        <option value="json">JSON (markdown content)</option>
                        <option value="html">JSON (HTML content)</option>
                        <option value="markdown">JSON (raw markdown)</option>
                      </select>
                    </div>
                  </div>
                  <div><label style={labelStyle}>Endpoint URL</label><input type="text" value={wh.url} onChange={(e) => updateWebhook(wh.id, "url", e.target.value)} placeholder="https://your-cms.com/api/articles" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Signing Secret <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span></label><PasswordInput value={wh.secret} onChange={(v) => updateWebhook(wh.id, "secret", v)} placeholder="Used to generate X-ArticleGen-Signature header" /></div>
                </div>
              </div>
            ))}
            <button onClick={addWebhook}
              style={{ padding: 14, borderRadius: 12, border: "2px dashed var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Webhook
            </button>
          </div>
        </section>

        {/* Generation Presets */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Generation Presets</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Save named configurations to quickly fill in the generate form.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {presets.map((preset) => (
              <div key={preset.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{preset.name || "Untitled Preset"}</span>
                  <button onClick={() => removePreset(preset.id)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>Remove</button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Preset Name</label><input value={preset.name} onChange={(e) => updatePreset(preset.id, "name", e.target.value)} placeholder="Tech Blog Post" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Target Audience</label><input value={preset.targetAudience} onChange={(e) => updatePreset(preset.id, "targetAudience", e.target.value)} placeholder="Software developers" style={inputStyle} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Quality</label>
                      <select value={preset.quality} onChange={(e) => updatePreset(preset.id, "quality", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                        <option value="standard">Standard (~2,000 words)</option>
                        <option value="premium">Premium (~4,000 words)</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Tone</label>
                      <select value={preset.tone} onChange={(e) => updatePreset(preset.id, "tone", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="technical">Technical</option>
                        <option value="conversational">Conversational</option>
                        <option value="authoritative">Authoritative</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
                      <input type="checkbox" id={`img-${preset.id}`} checked={preset.withImages} onChange={(e) => updatePreset(preset.id, "withImages", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent)" }} />
                      <label htmlFor={`img-${preset.id}`} style={{ fontSize: 13, cursor: "pointer" }}>Include AI images</label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addPreset}
              style={{ padding: 14, borderRadius: 12, border: "2px dashed var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Preset
            </button>
          </div>
        </section>

        {/* Google Search Console */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Google Search Console</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Import real keyword data from your site to pre-fill the article generator.</p>
          </div>
          <div style={cardStyle}>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {!gscConnected ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Not connected</p>
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>Connect your Google account to import top queries.</p>
                  </div>
                  <a href="/api/gsc/auth"
                    style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", textDecoration: "none", whiteSpace: "nowrap" }}>
                    Connect Google
                  </a>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>Connected</span>
                    </div>
                    <button onClick={disconnectGsc} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, background: "transparent", border: "1px solid var(--card-border)", cursor: "pointer", color: "var(--muted)" }}>
                      Disconnect
                    </button>
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <label style={labelStyle}>Property / Site</label>
                      <button onClick={fetchGscSites} disabled={gscLoadingSites} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        {gscLoadingSites ? "Loading..." : "Load sites ↻"}
                      </button>
                    </div>
                    {gscSites.length > 0 ? (
                      <select value={gscSiteUrl} onChange={(e) => setGscSiteUrl(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                        <option value="">Select a property...</option>
                        {gscSites.map((s) => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                      </select>
                    ) : (
                      <input value={gscSiteUrl} onChange={(e) => setGscSiteUrl(e.target.value)} placeholder="sc-domain:example.com" style={inputStyle} />
                    )}
                  </div>
                </>
              )}
              {gscMessage && (
                <p style={{ fontSize: 12, color: gscMessage.includes("fail") || gscMessage.includes("error") || gscMessage.includes("Error") ? "var(--error)" : "var(--success)", margin: 0 }}>
                  {gscMessage}
                </p>
              )}
            </div>
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

        {/* MCP Integration */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Claude Code (MCP)</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Use Article Gen directly from Claude Code — generate content, manage autopilot, and run SEO tools without leaving your terminal.</p>
          </div>
          <div style={cardStyle}>
            {mcpApiKey ? (
              <>
                {/* Token — copy to use in Authorization header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--card-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Your MCP Token</span>
                    <button
                      type="button"
                      disabled={mcpLoading}
                      onClick={() => { if (window.confirm("This will disconnect any existing Claude Code sessions. Continue?")) generateMcpKey(); }}
                      style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      {mcpLoading ? "Rotating..." : "Rotate Token"}
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <code style={{ flex: 1, fontFamily: "monospace", fontSize: 13, padding: "10px 14px", borderRadius: 8, background: "var(--background)", border: "1px solid var(--card-border)", letterSpacing: "0.1em", color: "var(--muted)" }}>
                      {"•".repeat(36)}
                    </code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(mcpApiKey)}
                      style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                      Copy Token
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>This token is unique to your account. Never share it or put it in a URL.</p>
                </div>

                {/* .mcp.json snippet */}
                <div style={{ padding: "16px 20px" }}>
                  <button
                    type="button"
                    onClick={() => setMcpSetupOpen((v) => !v)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: mcpSetupOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    How to connect Claude Code
                  </button>
                  {mcpSetupOpen && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                        Add this to your project&apos;s <code style={{ fontFamily: "monospace", fontSize: 11 }}>.mcp.json</code>, replacing <code style={{ fontFamily: "monospace", fontSize: 11 }}>YOUR_TOKEN</code> with the token you copied above:
                      </p>
                      <div style={{ position: "relative" }}>
                        <pre style={{ fontFamily: "monospace", fontSize: 12, padding: "14px 16px", borderRadius: 8, background: "var(--background)", border: "1px solid var(--card-border)", overflow: "auto", margin: 0 }}>{`{
  "mcpServers": {
    "article-gen": {
      "url": "${typeof window !== "undefined" ? window.location.origin.replace(/^http:/, "https:") : "https://YOUR_DOMAIN"}/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}`}</pre>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(`{\n  "mcpServers": {\n    "article-gen": {\n      "url": "${typeof window !== "undefined" ? window.location.origin.replace(/^http:/, "https:") : "https://YOUR_DOMAIN"}/api/mcp",\n      "headers": {\n        "Authorization": "Bearer ${mcpApiKey}"\n      }\n    }\n  }\n}`)}
                          style={{ position: "absolute", top: 8, right: 8, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "var(--card)", border: "1px solid var(--card-border)", cursor: "pointer" }}>
                          Copy
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>The token is sent as an HTTP header — it never appears in URLs or server logs.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Connect Claude Code</p>
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>Generate your personal MCP token to start using Article Gen from Claude Code.</p>
                </div>
                <button
                  type="button"
                  disabled={mcpLoading}
                  onClick={generateMcpKey}
                  style={{ padding: "9px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", opacity: mcpLoading ? 0.6 : 1 }}>
                  {mcpLoading ? "Setting up..." : "Activate Claude Code"}
                </button>
              </div>
            )}
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
