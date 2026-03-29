"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = ["Business", "Audience & Competitors", "Blog", "Articles", "Integration"] as const;
type Step = (typeof STEPS)[number];

// ─── Icons ────────────────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center rounded-full text-xs font-semibold transition-all duration-300"
                style={{
                  width: 22,
                  height: 22,
                  background: done || active ? "#7c3aed" : "transparent",
                  border: done || active ? "none" : "2px solid #d1d5db",
                  color: done || active ? "#fff" : "#9ca3af",
                }}
              >
                {done ? <CheckIcon /> : i + 1}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap hidden sm:block"
                style={{ color: active ? "#7c3aed" : done ? "#374151" : "#9ca3af" }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-px w-10 sm:w-16 mx-1 transition-all duration-300"
                style={{ background: i < current ? "#7c3aed" : "#d1d5db", marginBottom: 16 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200"
      style={{ background: checked ? "#7c3aed" : "#d1d5db" }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  max = 7,
}: {
  tags: string[];
  onAdd: (t: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
  max?: number;
}) {
  const [val, setVal] = useState("");

  const add = () => {
    const t = val.trim();
    if (t && tags.length < max) {
      onAdd(t);
      setVal("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          disabled={tags.length >= max}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 disabled:opacity-50 bg-white"
        />
        <button
          type="button"
          onClick={add}
          disabled={!val.trim() || tags.length >= max}
          className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2">
          {tags.map((tag, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800">
              <span className="truncate">{tag}</span>
              <button type="button" onClick={() => onRemove(i)} className="text-gray-400 hover:text-gray-700 flex-shrink-0 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400">{tags.length}/{max} added</p>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      {children}
    </div>
  );
}

const ARTICLE_STYLES = ["Informative", "Persuasive", "Listicle", "How-to Guide", "Comparison", "News", "Opinion"];
const INTERNAL_LINK_OPTIONS = ["0 links", "1 link per article", "2 links per article", "3 links per article", "5 links per article"];
const IMAGE_STYLES = ["Brand & Text", "Watercolor", "Cinematic", "Illustration", "Sketch", "Photorealistic"];

const INTEGRATIONS = [
  { id: "notion", name: "Notion", icon: "N", color: "#000", bg: "#f3f4f6" },
  { id: "wordpress", name: "WordPress", icon: "W", color: "#21759b", bg: "#e8f4f8" },
  { id: "wordpress_com", name: "WordPress.com", icon: "W", color: "#0073aa", bg: "#e6f2f8" },
  { id: "shopify", name: "Shopify", icon: "S", color: "#5b8c3d", bg: "#eef5ea" },
  { id: "wix", name: "Wix", icon: "WX", color: "#000", bg: "#f3f4f6" },
  { id: "webflow", name: "Webflow", icon: "WF", color: "#146ef5", bg: "#eaf1fe" },
  { id: "webhook", name: "API Webhook", icon: "⚡", color: "#374151", bg: "#f3f4f6" },
  { id: "framer", name: "Framer", icon: "F", color: "#0055ff", bg: "#ebefff" },
  { id: "ghost", name: "Ghost", icon: "G", color: "#15212a", bg: "#eef0f1" },
  { id: "devto", name: "Dev.to", icon: "D", color: "#000", bg: "#f3f4f6" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — Business
  const [businessName, setBusinessName] = useState("");
  const [businessUrl, setBusinessUrl] = useState("");
  const [businessDesc, setBusinessDesc] = useState("");
  const [niche, setNiche] = useState("");

  // Step 2 — Audience & Competitors
  const [audiences, setAudiences] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);

  // Step 3 — Blog
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [blogUrl, setBlogUrl] = useState("");
  const [exampleUrls, setExampleUrls] = useState(["", "", ""]);

  // Step 4 — Articles
  const [autoPublish, setAutoPublish] = useState(false);
  const [articleStyle, setArticleStyle] = useState("Informative");
  const [internalLinks, setInternalLinks] = useState("3 links per article");
  const [globalInstructions, setGlobalInstructions] = useState("");
  const [brandColor, setBrandColor] = useState("#000000");
  const [imageStyle, setImageStyle] = useState("Cinematic");

  // Step 5 — Integration
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  // Site analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      // Check if onboarding already complete
      try {
        const res = await fetch("/api/onboarding/status");
        const data = await res.json();
        if (data.onboarding_complete) {
          router.replace("/app");
          return;
        }
      } catch {
        // proceed
      }

      setCheckingAuth(false);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAndNext = async () => {
    setSaving(true);
    setError("");

    try {
      if (step === 0) {
        if (!businessName.trim() || !businessUrl.trim()) {
          setError("Business name and website URL are required.");
          setSaving(false);
          return;
        }
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_name: businessName.trim(),
            domain: businessUrl.trim(),
            site_about: businessDesc.trim(),
            niche: niche.trim(),
          }),
        });
      }

      if (step === 1) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_audiences: audiences,
            competitors,
          }),
        });
      }

      if (step === 2) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sitemap_url: sitemapUrl.trim(),
            blog_url: blogUrl.trim(),
            example_article_urls: exampleUrls.filter(Boolean),
          }),
        });
      }

      if (step === 3) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auto_publish: autoPublish,
            article_style: articleStyle,
            internal_links: internalLinks,
            global_instructions: globalInstructions.trim(),
            brand_color: brandColor,
            image_style: imageStyle,
          }),
        });
      }

      setStep((s) => s + 1);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const analyzeSite = async () => {
    if (!businessUrl.trim()) {
      setAnalyzeError("Enter your website URL first.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const res = await fetch("/api/onboarding/analyze-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: businessUrl.trim(), niche: niche.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Analysis failed");

      // Auto-fill fields
      if (data.niche && !niche) setNiche(data.niche);
      if (data.businessDescription && !businessDesc) setBusinessDesc(data.businessDescription);
      if (data.targetAudiences?.length > 0) setAudiences(data.targetAudiences.slice(0, 5));
      if (data.competitors?.length > 0) setCompetitors(data.competitors.slice(0, 5));
      if (data.suggestedSitemapUrl) setSitemapUrl(data.suggestedSitemapUrl);
      if (data.suggestedBlogUrl) setBlogUrl(data.suggestedBlogUrl);
      setAnalyzed(true);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed. Fill in manually.");
    } finally {
      setAnalyzing(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    setError("");
    try {
      if (selectedIntegration) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferred_integration: selectedIntegration }),
        });
      }
      await fetch("/api/onboarding/complete", { method: "POST" });

      // Fire plan generation in the background — don't await, autopilot page handles loading
      if (niche.trim()) {
        fetch("/api/autopilot/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            niche: niche.trim(),
            targetAudience: audiences.join(", ") || undefined,
            competitors: competitors.length ? competitors : undefined,
            startDate: new Date().toISOString().split("T")[0],
            count: 30,
          }),
        }).catch(() => {/* silent — autopilot page allows manual regeneration */});
      }

      // Always land on autopilot so user sees their 30-day plan immediately
      router.push(
        selectedIntegration && selectedIntegration !== "webhook"
          ? `/app/autopilot?setup=${selectedIntegration}`
          : "/app/autopilot"
      );
    } catch {
      setError("Failed to finish. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <svg className="animate-spin h-5 w-5 text-[#7c3aed]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 bg-white transition-all";

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <StepIndicator current={step} />

        {/* Step 1 — Business */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Tell us about your business</h2>
              <p className="text-gray-500 mt-1 text-sm">This helps us tailor articles to your brand and audience</p>
            </div>
            <Card>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business name <span className="text-red-500">*</span></label>
                    <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Article Sauce" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Website URL <span className="text-red-500">*</span></label>
                    <input value={businessUrl} onChange={(e) => { setBusinessUrl(e.target.value); setAnalyzed(false); }} placeholder="https://yourblog.com" className={inputCls} />
                  </div>
                </div>

                {/* Analyze button */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={analyzeSite}
                    disabled={analyzing || !businessUrl.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 border"
                    style={{
                      background: analyzed ? "#f0fdf4" : "#f5f3ff",
                      borderColor: analyzed ? "#bbf7d0" : "#c4b5fd",
                      color: analyzed ? "#15803d" : "#7c3aed",
                    }}
                  >
                    {analyzing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analyzing your site…
                      </>
                    ) : analyzed ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Site analyzed — re-analyze
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        Auto-fill from URL
                      </>
                    )}
                  </button>
                  {!analyzed && !analyzing && (
                    <p className="text-xs text-gray-400">We&apos;ll research your site and pre-fill the fields below</p>
                  )}
                  {analyzed && (
                    <p className="text-xs text-green-600">Audiences and competitors pre-filled from your site ✓</p>
                  )}
                </div>
                {analyzeError && (
                  <p className="text-xs text-red-500">{analyzeError}</p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Niche / Industry</label>
                  <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. SaaS, E-commerce, Health & Fitness" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">What does your business do?</label>
                  <textarea
                    value={businessDesc}
                    onChange={(e) => setBusinessDesc(e.target.value)}
                    placeholder="We help SaaS founders grow their organic traffic with AI-generated articles..."
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Step 2 — Audience & Competitors */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Define your Target Audience and Competitors</h2>
              <p className="text-gray-500 mt-1 text-sm">Understanding your audience and competition ensures we generate the most effective keywords</p>
            </div>
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Target Audiences</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Enter your target audience groups to create relevant content. Better audience understanding improves results</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{audiences.length}/7</span>
              </div>
              <TagInput
                tags={audiences}
                onAdd={(t) => setAudiences((a) => [...a, t])}
                onRemove={(i) => setAudiences((a) => a.filter((_, idx) => idx !== i))}
                placeholder="e.g. Developers, Project Managers"
                max={7}
              />
            </Card>
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Competitors</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Enter competitors to discover the SEO keywords they rank for. Bigger competitors provide more valuable insights</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{competitors.length}/7</span>
              </div>
              <TagInput
                tags={competitors}
                onAdd={(t) => setCompetitors((a) => [...a, t])}
                onRemove={(i) => setCompetitors((a) => a.filter((_, idx) => idx !== i))}
                placeholder="e.g. https://competitor.ai or competitor.ai"
                max={7}
              />
            </Card>
          </div>
        )}

        {/* Step 3 — Blog */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Help us understand your content</h2>
              <p className="text-gray-500 mt-1 text-sm">Share your content details to help us create more relevant and targeted blog posts for your audience</p>
            </div>
            <Card>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Sitemap URL
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] cursor-help" title="Your XML sitemap helps us understand your existing content">?</span>
                  </label>
                  <input value={sitemapUrl} onChange={(e) => setSitemapUrl(e.target.value)} placeholder="https://yourblog.com/sitemap.xml" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Main blog address
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] cursor-help" title="The URL where your blog posts live">?</span>
                  </label>
                  <input value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)} placeholder="https://yourblog.com/blog" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Your best article examples URL
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] cursor-help" title="Examples of articles you're proud of — we'll match their style">?</span>
                  </label>
                  <div className="space-y-2">
                    {exampleUrls.map((url, i) => (
                      <input
                        key={i}
                        value={url}
                        onChange={(e) => setExampleUrls((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                        placeholder={`Your top article URL #${i + 1}`}
                        className={inputCls}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-gray-50 border border-gray-200">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Connect Google Search Console</p>
                    <p className="text-xs text-gray-500 mt-0.5">Avoid suggesting keywords you already rank for</p>
                  </div>
                  <a
                    href="/api/gsc/auth"
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: "#1a1a1a" }}
                  >
                    Connect GSC
                  </a>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Step 4 — Articles */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Configure your article preferences</h2>
              <p className="text-gray-500 mt-1 text-sm">Set your preferences once to ensure all future articles maintain your quality standards and brand consistency</p>
            </div>

            <Card>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Content & SEO</h3>
              <div className="space-y-5">
                {/* Auto publish */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Auto-publish</p>
                    <p className="text-xs text-gray-500 mt-0.5">Publish new articles automatically</p>
                  </div>
                  <Toggle checked={autoPublish} onChange={setAutoPublish} />
                </div>

                {/* Article style + Internal links */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Article Style
                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] cursor-help" title="The primary style of your articles">?</span>
                    </label>
                    <div className="relative">
                      <select
                        value={articleStyle}
                        onChange={(e) => setArticleStyle(e.target.value)}
                        className={`${inputCls} pr-8 appearance-none cursor-pointer`}
                      >
                        {ARTICLE_STYLES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Internal Links
                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] cursor-help" title="How many internal links per article">?</span>
                    </label>
                    <div className="relative">
                      <select
                        value={internalLinks}
                        onChange={(e) => setInternalLinks(e.target.value)}
                        className={`${inputCls} pr-8 appearance-none cursor-pointer`}
                      >
                        {INTERNAL_LINK_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                    </div>
                  </div>
                </div>

                {/* Global instructions */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Global Article Instructions
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] cursor-help" title="Instructions applied to every article">?</span>
                  </label>
                  <textarea
                    value={globalInstructions}
                    onChange={(e) => setGlobalInstructions(e.target.value)}
                    placeholder="Enter global instructions for all articles (e.g., 'Always include practical examples', 'Focus on actionable insights')..."
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Engagement</h3>
              <div className="space-y-5">
                {/* Brand color */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-9 h-9 rounded cursor-pointer border border-gray-200 p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 w-32 font-mono"
                    />
                  </div>
                </div>

                {/* Image style */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Image Style</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {IMAGE_STYLES.map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setImageStyle(style)}
                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all text-xs font-medium"
                        style={{
                          borderColor: imageStyle === style ? "#7c3aed" : "#e5e7eb",
                          background: imageStyle === style ? "#f5f3ff" : "#fff",
                          color: imageStyle === style ? "#7c3aed" : "#374151",
                        }}
                      >
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-lg">
                          {style === "Brand & Text" ? "🏷" : style === "Watercolor" ? "🎨" : style === "Cinematic" ? "🎬" : style === "Illustration" ? "✏️" : style === "Sketch" ? "🖊" : "📷"}
                        </div>
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Step 5 — Integration */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Create Integrations</h2>
              <p className="text-gray-500 mt-1 text-sm">Connect your blog to publish articles automatically, or set this up later in your dashboard.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {INTEGRATIONS.map((intg) => (
                <button
                  key={intg.id}
                  type="button"
                  onClick={() => setSelectedIntegration(selectedIntegration === intg.id ? null : intg.id)}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: selectedIntegration === intg.id ? "#7c3aed" : "#e5e7eb",
                    background: selectedIntegration === intg.id ? "#f5f3ff" : intg.bg,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: intg.bg, color: intg.color, border: `1px solid ${intg.color}20` }}
                  >
                    {intg.icon}
                  </div>
                  <span className="text-xs font-medium text-gray-800">{intg.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-center text-sm text-red-500 mt-4">{error}</p>
        )}

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            onClick={() => step > 0 ? setStep((s) => s - 1) : router.push("/")}
            className="px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={saveAndNext}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg text-white transition-opacity disabled:opacity-60"
              style={{ background: "#7c3aed" }}
            >
              {saving ? "Saving…" : "Continue"}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={finish}
                disabled={saving}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {saving ? "…" : "Skip & Get Started"}
              </button>
              <button
                type="button"
                onClick={finish}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-semibold rounded-lg text-white transition-opacity disabled:opacity-60"
                style={{ background: "#7c3aed" }}
              >
                {saving ? "Finishing…" : selectedIntegration ? `Connect ${INTEGRATIONS.find((i) => i.id === selectedIntegration)?.name ?? ""} →` : "Skip & Get Started"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
