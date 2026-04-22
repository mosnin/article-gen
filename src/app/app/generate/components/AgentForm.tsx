"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Platform = { kind: "wordpress" | "ghost" | "medium" | "shopify" | "devto"; id: string };

export function AgentForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [tone, setTone] = useState("professional");
  const [targetAudience, setTargetAudience] = useState("");
  const [quality, setQuality] = useState<"standard" | "premium">("standard");
  const [autoPublish, setAutoPublish] = useState(false);
  const [platformsJson, setPlatformsJson] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let platforms: Platform[] = [];
    if (autoPublish && platformsJson.trim()) {
      try { platforms = JSON.parse(platformsJson); } catch { setError("platforms JSON invalid"); setSubmitting(false); return; }
    }

    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "article",
          topic: topic.trim(),
          focusKeyword: focusKeyword.trim() || undefined,
          tone: tone || undefined,
          targetAudience: targetAudience.trim() || undefined,
          quality,
          options: {
            imageCount: 4,
            autoPublish,
            platforms: autoPublish ? platforms : [],
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error || `request failed (${resp.status})`);
        return;
      }
      router.push(`/app/agent-runs/${data.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)]">Topic</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          required
          placeholder="e.g. How to price a SaaS product"
          className="mt-1 w-full rounded border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)]">Focus keyword</label>
        <input
          value={focusKeyword}
          onChange={(e) => setFocusKeyword(e.target.value)}
          placeholder="e.g. saas pricing"
          className="mt-1 w-full rounded border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)]">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            {["professional", "conversational", "authoritative", "friendly", "technical"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)]">Quality</label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as "standard" | "premium")}
            className="mt-1 w-full rounded border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="standard">standard (1 credit)</option>
            <option value="premium">premium (3 credits)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)]">Target audience</label>
        <input
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          placeholder="e.g. indie founders"
          className="mt-1 w-full rounded border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} />
          <span className="text-[var(--text-secondary)]">Auto-publish to platforms on completion</span>
        </label>
        {autoPublish && (
          <textarea
            value={platformsJson}
            onChange={(e) => setPlatformsJson(e.target.value)}
            rows={3}
            placeholder='[{"kind":"wordpress","id":"blog-uuid"}]'
            className="mt-2 w-full rounded border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 font-mono text-xs"
          />
        )}
      </div>

      {error && (
        <div className="rounded border border-[var(--danger)] bg-[var(--danger-light)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !topic.trim()}
        className={cn(
          "w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-medium text-white",
          "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {submitting ? "Starting agent run..." : "Start agent run"}
      </button>
      <p className="text-xs text-[var(--text-tertiary)]">
        The orchestrator will plan, research, write, and save the article autonomously. You'll see live progress on the next page.
      </p>
    </form>
  );
}
