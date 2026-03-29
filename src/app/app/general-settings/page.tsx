"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "business" | "audience" | "gsc";

const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Polish", "Japanese", "Chinese", "Korean", "Arabic"];
const COUNTRIES = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Spain", "Brazil", "India", "Japan", "Mexico", "Netherlands"];

interface BusinessInfo {
  websiteUrl: string;
  businessName: string;
  language: string;
  country: string;
  description: string;
}

interface AudienceInfo {
  targetAudiences: string[];
  competitors: string[];
  topKeywords: string[];
}

interface GscInfo {
  connected: boolean;
  siteUrl: string;
  verifiedAt: string | null;
}

export default function GeneralSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<Tab>("business");
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [gscDisconnecting, setGscDisconnecting] = useState(false);

  const [business, setBusiness] = useState<BusinessInfo>({
    websiteUrl: "",
    businessName: "",
    language: "English",
    country: "United States",
    description: "",
  });

  const [audience, setAudience] = useState<AudienceInfo>({
    targetAudiences: [],
    competitors: [],
    topKeywords: [],
  });

  const [gsc, setGsc] = useState<GscInfo>({
    connected: false,
    siteUrl: "",
    verifiedAt: null,
  });

  // Tag input state
  const [audienceInput, setAudienceInput] = useState("");
  const [competitorInput, setCompetitorInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    // Handle GSC OAuth redirect back to this page
    const params = new URLSearchParams(window.location.search);
    if (params.get("gsc_connected") === "1") {
      setGsc((prev) => ({ ...prev, connected: true }));
      toast.success("Google Search Console connected!");
      window.history.replaceState({}, "", "/app/general-settings");
    } else if (params.get("gsc_error")) {
      toast.error(`GSC connection failed: ${params.get("gsc_error")}`);
      window.history.replaceState({}, "", "/app/general-settings");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const res = await fetch("/api/settings");
      const json = await res.json();
      const s = json.settings;
      if (!s) return;

      // Map canonical settings fields (written by onboarding + settings API)
      setBusiness((prev) => ({
        ...prev,
        websiteUrl: s.domain || s.website_url || prev.websiteUrl,
        businessName: s.site_name || s.business_name || prev.businessName,
        description: s.site_about || (s.general_settings as { description?: string })?.description || prev.description,
        language: (s.general_settings as { language?: string })?.language || prev.language,
        country: (s.general_settings as { country?: string })?.country || prev.country,
      }));

      // Audience data — try audience_settings blob first, fall back to top-level arrays
      const savedAudience = s.audience_settings as Partial<AudienceInfo> | null;
      setAudience((prev) => ({
        targetAudiences: savedAudience?.targetAudiences ?? (s.target_audiences as string[] | undefined) ?? prev.targetAudiences,
        competitors: savedAudience?.competitors ?? (s.competitors as string[] | undefined) ?? prev.competitors,
        topKeywords: savedAudience?.topKeywords ?? prev.topKeywords,
      }));

      // GSC
      if (s.gsc_connected || s.gsc_site_url) {
        setGsc((prev) => ({
          ...prev,
          connected: !!s.gsc_connected,
          siteUrl: s.gsc_site_url || prev.siteUrl,
        }));
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Canonical fields used by onboarding + generation
          domain: business.websiteUrl,
          site_name: business.businessName,
          site_about: business.description,
          target_audiences: audience.targetAudiences,
          competitors: audience.competitors,
          // Extended blobs for fields not in base schema
          general_settings: business,
          audience_settings: audience,
          gsc_settings: gsc,
          website_url: business.websiteUrl,
          business_name: business.businessName,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFill = async () => {
    if (!business.websiteUrl) {
      toast.error("Enter a website URL first");
      return;
    }
    setAutoFilling(true);
    try {
      const res = await fetch("/api/onboarding/analyze-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: business.websiteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBusiness((prev) => ({
        ...prev,
        description: data.businessDescription ?? prev.description,
      }));
      if (data.targetAudiences?.length) {
        setAudience((prev) => ({ ...prev, targetAudiences: data.targetAudiences }));
      }
      if (data.competitors?.length) {
        setAudience((prev) => ({ ...prev, competitors: data.competitors }));
      }
      if (data.topKeywords?.length) {
        setAudience((prev) => ({ ...prev, topKeywords: data.topKeywords }));
      }
      toast.success("Auto-filled from your website");
    } catch {
      toast.error("Failed to analyze site");
    } finally {
      setAutoFilling(false);
    }
  };

  const addTag = (list: string[], setList: (v: string[]) => void, val: string, max = 10) => {
    const trimmed = val.trim();
    if (!trimmed || list.includes(trimmed) || list.length >= max) return;
    setList([...list, trimmed]);
  };

  const removeTag = (list: string[], setList: (v: string[]) => void, idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "business", label: "Business" },
    { id: "audience", label: "Audience and Competitors" },
    { id: "gsc", label: "Google Search Console" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Tab bar */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] p-1 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Business Tab */}
      {activeTab === "business" && (
        <div className="space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">About your business</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Provide your business information to personalize content generation and SEO strategies
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] overflow-hidden divide-y divide-[var(--border-default)]">
            <div className="px-5 py-4">
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Website to business</label>
              <input
                type="url"
                value={business.websiteUrl}
                onChange={(e) => setBusiness((p) => ({ ...p, websiteUrl: e.target.value }))}
                placeholder="https://yourdomain.com"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
              />
            </div>

            <div className="px-5 py-4">
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Business name</label>
              <input
                type="text"
                value={business.businessName}
                onChange={(e) => setBusiness((p) => ({ ...p, businessName: e.target.value }))}
                placeholder="Your business name"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-0 divide-x divide-[var(--border-default)]">
              <div className="px-5 py-4">
                <div className="mb-1.5 flex items-center gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Language</label>
                  <button className="text-[var(--text-tertiary)]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={business.language}
                    onChange={(e) => setBusiness((p) => ({ ...p, language: e.target.value }))}
                    className="w-full appearance-none rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 pr-8 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  >
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="mb-1.5 flex items-center gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Country</label>
                  <button className="text-[var(--text-tertiary)]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={business.country}
                    onChange={(e) => setBusiness((p) => ({ ...p, country: e.target.value }))}
                    className="w-full appearance-none rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 pr-8 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  >
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
                <button
                  onClick={handleAutoFill}
                  disabled={autoFilling}
                  className="rounded-lg border border-[var(--border-default)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors disabled:opacity-50"
                >
                  {autoFilling ? "Analyzing…" : "Autocomplete With AI"}
                </button>
              </div>
              <textarea
                rows={8}
                value={business.description}
                onChange={(e) => setBusiness((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe your business, what you do, who you serve, and what makes you unique…"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Audience and Competitors Tab */}
      {activeTab === "audience" && (
        <div className="space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Audience & Competitors</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Define your target audience and track competitors to sharpen your SEO strategy
            </p>
          </div>

          {[
            {
              label: "Target Audiences",
              placeholder: "e.g. B2B SaaS founders looking to grow organic traffic",
              items: audience.targetAudiences,
              setItems: (v: string[]) => setAudience((p) => ({ ...p, targetAudiences: v })),
              input: audienceInput,
              setInput: setAudienceInput,
            },
            {
              label: "Competitors",
              placeholder: "e.g. competitor.com",
              items: audience.competitors,
              setItems: (v: string[]) => setAudience((p) => ({ ...p, competitors: v })),
              input: competitorInput,
              setInput: setCompetitorInput,
            },
            {
              label: "Target Keywords",
              placeholder: "e.g. best SEO tools for small business",
              items: audience.topKeywords,
              setItems: (v: string[]) => setAudience((p) => ({ ...p, topKeywords: v })),
              input: keywordInput,
              setInput: setKeywordInput,
            },
          ].map((field) => (
            <div key={field.label} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5">
              <label className="mb-3 block text-sm font-semibold text-[var(--text-primary)]">{field.label}</label>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {field.items.map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-full bg-[var(--accent-light)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                    {item}
                    <button onClick={() => removeTag(field.items, field.setItems, i)} className="hover:opacity-70">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={field.input}
                  onChange={(e) => field.setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && field.input) {
                      addTag(field.items, field.setItems, field.input);
                      field.setInput("");
                    }
                  }}
                  placeholder={field.placeholder}
                  className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { addTag(field.items, field.setItems, field.input); field.setInput(""); }}
                  disabled={!field.input}
                >
                  Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Google Search Console Tab */}
      {activeTab === "gsc" && (
        <div className="space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Google Search Console</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Connect Google Search Console to get keyword and performance data for your site
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-6">
            {gsc.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-[var(--success)] bg-green-50 px-4 py-3">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-[var(--success)]">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-800">Connected</p>
                    <p className="text-xs text-green-600">{gsc.siteUrl}</p>
                  </div>
                  <button
                    disabled={gscDisconnecting}
                    onClick={async () => {
                      setGscDisconnecting(true);
                      try {
                        const res = await fetch("/api/gsc/disconnect", { method: "POST" });
                        if (!res.ok) throw new Error("Failed");
                        setGsc({ connected: false, siteUrl: "", verifiedAt: null });
                        toast.success("Google Search Console disconnected");
                      } catch {
                        toast.error("Failed to disconnect Google Search Console");
                      } finally {
                        setGscDisconnecting(false);
                      }
                    }}
                    className="ml-auto text-xs text-[var(--error)] hover:underline disabled:opacity-50"
                  >
                    {gscDisconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#4285F4" />
                    <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" fill="white" />
                    <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" fill="#34A853" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Connect Google Search Console</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Get keyword rankings, impressions, and click data to inform your content strategy
                  </p>
                </div>
                <Button
                  onClick={() => {
                    window.location.href = "/api/gsc/auth?returnTo=/app/general-settings";
                  }}
                >
                  Connect with Google
                </Button>
                <div className="w-full space-y-2">
                  <p className="text-xs text-[var(--text-tertiary)]">Or enter your site URL manually:</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={gsc.siteUrl}
                      onChange={(e) => setGsc((p) => ({ ...p, siteUrl: e.target.value }))}
                      placeholder="https://yourdomain.com"
                      className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (gsc.siteUrl) {
                          setGsc((p) => ({ ...p, connected: true, verifiedAt: new Date().toISOString() }));
                          toast.success("Site URL saved");
                        }
                      }}
                      disabled={!gsc.siteUrl}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} className="px-8">
          Save
        </Button>
      </div>
    </div>
  );
}
