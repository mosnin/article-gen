"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import AppShell from "@/components/app-shell";

interface WpBlog {
  id: string;
  name: string;
  url: string;
  username: string;
  appPassword: string;
  authorName: string;
  authorAbout: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blogs, setBlogs] = useState<WpBlog[]>([]);
  const [testingBlogId, setTestingBlogId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Site settings
  const [domain, setDomain] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteAbout, setSiteAbout] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const fetchSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/?auth=login"); return; }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (settings) {
      setDomain(settings.domain || "");
      setSiteName(settings.site_name || "");
      setSiteAbout(settings.site_about || "");

      // Load blogs from wp_blogs JSON column or migrate from old single fields
      if (settings.wp_blogs && Array.isArray(settings.wp_blogs) && settings.wp_blogs.length > 0) {
        setBlogs(settings.wp_blogs);
      } else if (settings.wp_url) {
        // Migrate old single blog to new format
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
    }
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSaveMessage("Failed to save: not logged in");
        setSaving(false);
        return;
      }

      // Also update legacy fields with first blog for backwards compat
      const firstBlog = blogs.find((b) => b.url && b.username && b.appPassword);
      const firstBlogWithAuthor = blogs.find((b) => b.authorName?.trim());

      const settingsPayload = {
        domain,
        site_name: siteName,
        site_about: siteAbout,
        author_name: firstBlogWithAuthor?.authorName || "",
        author_about: firstBlogWithAuthor?.authorAbout || "",
        wp_blogs: blogs.filter((b) => b.url.trim()),
        wp_url: firstBlog?.url || "",
        wp_username: firstBlog?.username || "",
        wp_app_password: firstBlog?.appPassword || "",
        updated_at: new Date().toISOString(),
      };

      // Check if row exists first, then insert or update
      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", user.id)
        .single();

      let error;
      if (existing) {
        // Update existing row
        const result = await supabase
          .from("user_settings")
          .update(settingsPayload)
          .eq("user_id", user.id);
        error = result.error;
      } else {
        // Insert new row
        const result = await supabase
          .from("user_settings")
          .insert({ user_id: user.id, ...settingsPayload });
        error = result.error;
      }

      if (error) {
        console.error("Settings save error:", error);
        setSaveMessage(`Failed to save: ${error.message}`);
      } else {
        setSaveMessage("Settings saved");
        setTimeout(() => setSaveMessage(""), 2500);
      }
    } catch (err) {
      console.error("Settings save exception:", err);
      setSaveMessage(`Failed to save: ${err instanceof Error ? err.message : "unexpected error"}`);
    } finally {
      setSaving(false);
    }
  };

  const addBlog = () => {
    if (blogs.length >= 3) return;
    setBlogs((prev) => [...prev, {
      id: crypto.randomUUID(),
      name: "",
      url: "",
      username: "",
      appPassword: "",
      authorName: "",
      authorAbout: "",
    }]);
  };

  const removeBlog = (id: string) => {
    setBlogs((prev) => prev.filter((b) => b.id !== id));
    setTestResults((prev) => { const next = { ...prev }; delete next[id]; return next; });
  };

  const updateBlog = (id: string, field: keyof WpBlog, value: string) => {
    setBlogs((prev) => prev.map((b) => b.id === id ? { ...b, [field]: value } : b));
    // Clear test result when editing
    if (testResults[id]) {
      setTestResults((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

  const testConnection = async (blog: WpBlog) => {
    setTestingBlogId(blog.id);
    setTestResults((prev) => ({ ...prev, [blog.id]: { ok: false, message: "Testing..." } }));

    try {
      const wpUrl = blog.url.replace(/\/$/, "");
      const auth = btoa(`${blog.username}:${blog.appPassword}`);

      const res = await fetch(`${wpUrl}/wp-json/wp/v2/categories?per_page=1`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (res.ok) {
        setTestResults((prev) => ({ ...prev, [blog.id]: { ok: true, message: "Connected!" } }));
      } else if (res.status === 401 || res.status === 403) {
        setTestResults((prev) => ({ ...prev, [blog.id]: { ok: false, message: "Authentication failed. Check credentials." } }));
      } else {
        setTestResults((prev) => ({ ...prev, [blog.id]: { ok: false, message: `Error: ${res.status}` } }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [blog.id]: { ok: false, message: "Could not connect. Check the URL." } }));
    }

    setTestingBlogId(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--background)" }}>
        <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
      </div>
    );
  }

  return (
    <AppShell title="Settings" onSignOut={handleLogout}>
        {/* WordPress Blogs */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>WordPress Blogs</h2>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Connect up to 3 WordPress sites for publishing. Articles won&apos;t auto-publish &mdash; you choose when to publish.</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {blogs.map((blog, idx) => (
              <div key={blog.id} style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--card-border)", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{blog.name || `Blog ${idx + 1}`}</span>
                    {testResults[blog.id] && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: testResults[blog.id].ok ? "var(--success)" : "var(--error)", marginLeft: 4 }}>
                        {testResults[blog.id].message}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeBlog(blog.id)}
                    style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Blog Name</label>
                      <input
                        type="text"
                        value={blog.name}
                        onChange={(e) => updateBlog(blog.id, "name", e.target.value)}
                        placeholder="My Blog"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>WordPress URL</label>
                      <input
                        type="text"
                        value={blog.url}
                        onChange={(e) => updateBlog(blog.id, "url", e.target.value)}
                        placeholder="https://yourblog.com"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Username</label>
                      <input
                        type="text"
                        value={blog.username}
                        onChange={(e) => updateBlog(blog.id, "username", e.target.value)}
                        placeholder="admin"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Application Password</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showPasswords[blog.id] ? "text" : "password"}
                          value={blog.appPassword}
                          onChange={(e) => updateBlog(blog.id, "appPassword", e.target.value)}
                          placeholder="xxxx xxxx xxxx xxxx"
                          style={{ width: "100%", padding: "8px 12px", paddingRight: 36, borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" }}
                        />
                        <button
                          onClick={() => setShowPasswords((prev) => ({ ...prev, [blog.id]: !prev[blog.id] }))}
                          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {showPasswords[blog.id] ? (
                              <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                            ) : (
                              <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                            )}
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Author Name</label>
                      <input
                        type="text"
                        value={blog.authorName || ""}
                        onChange={(e) => updateBlog(blog.id, "authorName", e.target.value)}
                        placeholder="John Doe"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>About the Author</label>
                      <input
                        type="text"
                        value={blog.authorAbout || ""}
                        onChange={(e) => updateBlog(blog.id, "authorAbout", e.target.value)}
                        placeholder="Expert in sustainable living with 10 years of experience"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>
                      WordPress &gt; Users &gt; Profile &gt; Application Passwords
                    </p>
                    <button
                      onClick={() => testConnection(blog)}
                      disabled={!blog.url || !blog.username || !blog.appPassword || testingBlogId === blog.id}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: "var(--background)", border: "1px solid var(--card-border)",
                        cursor: "pointer", opacity: (!blog.url || !blog.username || !blog.appPassword) ? 0.4 : 1,
                      }}
                    >
                      {testingBlogId === blog.id ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {blogs.length < 3 && (
              <button
                onClick={addBlog}
                style={{
                  padding: "14px", borderRadius: 12, border: "2px dashed var(--card-border)",
                  background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add WordPress Blog ({blogs.length}/3)
              </button>
            )}
          </div>
        </section>

        {/* Site & Author Settings */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Site Settings</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Used to personalize generated articles with your brand. Author info is set per blog above.</p>

          <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Domain", value: domain, set: setDomain, placeholder: "https://yourblog.com" },
              { label: "Site Name", value: siteName, set: setSiteName, placeholder: "Your Blog Name" },
              { label: "About the Blog", value: siteAbout, set: setSiteAbout, placeholder: "A blog about sustainable living and eco-friendly tips" },
            ].map((field) => (
              <div key={field.label}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>{field.label}</label>
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Save */}
        <div style={{ position: "sticky", bottom: 0, padding: "16px 0", background: "var(--background)", borderTop: "1px solid var(--card-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: saveMessage === "Settings saved" ? "var(--success)" : "var(--error)" }}>
              {saveMessage}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "10px 28px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
    </AppShell>
  );
}
