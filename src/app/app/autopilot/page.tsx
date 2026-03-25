"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AutopilotSlot {
  id: string;
  day: number;
  date: string;
  keyword: string;
  topic: string;
  contentType: string;
  status: "pending" | "approved" | "rejected" | "generating" | "done" | "failed";
  articleId: string | null;
}

const STATUS_CONFIG: Record<AutopilotSlot["status"], { label: string; variant: "default" | "success" | "warning" | "error" | "neutral" }> = {
  pending: { label: "Pending", variant: "neutral" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "error" },
  generating: { label: "Generating…", variant: "warning" },
  done: { label: "Published", variant: "success" },
  failed: { label: "Failed", variant: "error" },
};

const CONTENT_TYPE_EMOJI: Record<string, string> = {
  "How-to Guide": "📖",
  "Listicle": "📋",
  "Comparison": "⚖️",
  "Case Study": "🔬",
  "Review": "⭐",
  "Tutorial": "🎯",
  "Ultimate Guide": "🏆",
};

function SlotCard({ slot, onApprove, onReject, onEdit, onGenerate, generatingId }: {
  slot: AutopilotSlot;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (slot: AutopilotSlot) => void;
  onGenerate: (slot: AutopilotSlot) => void;
  generatingId: string | null;
}) {
  const config = STATUS_CONFIG[slot.status];
  const emoji = CONTENT_TYPE_EMOJI[slot.contentType] ?? "📝";
  const isThisGenerating = generatingId === slot.id;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200",
        slot.status === "approved" && "border-blue-200 bg-blue-50/50",
        slot.status === "done" && "border-green-200 bg-green-50/50",
        slot.status === "rejected" && "border-red-100 bg-red-50/30 opacity-60",
        slot.status === "generating" && "border-amber-200 bg-amber-50/50",
        slot.status === "pending" && "border-[var(--border-default)] bg-[var(--surface-base)]",
        slot.status === "failed" && "border-red-200 bg-red-50/40",
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">{emoji}</span>
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-secondary)]">Day {slot.day} · {slot.date}</p>
            <p className="text-sm font-medium text-[var(--text-primary)] leading-snug mt-0.5 line-clamp-2">{slot.topic}</p>
          </div>
        </div>
        <Badge variant={config.variant} className="shrink-0 text-[10px]">{config.label}</Badge>
      </div>

      {/* Keyword */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-sunken)] text-[11px] text-[var(--text-secondary)] font-mono">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
          {slot.keyword}
        </span>
        <span className="text-[11px] text-[var(--text-tertiary)]">{slot.contentType}</span>
      </div>

      {/* Actions */}
      {slot.status === "pending" && (
        <div className="flex gap-1.5 mt-1">
          <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => onApprove(slot.id)}>
            Approve
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => onEdit(slot)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onReject(slot.id)}>
            ✕
          </Button>
        </div>
      )}

      {slot.status === "approved" && (
        <div className="flex gap-1.5 mt-1">
          <Button
            size="sm"
            className="flex-1 h-7 text-xs"
            loading={isThisGenerating}
            onClick={() => onGenerate(slot)}
          >
            {isThisGenerating ? "Generating…" : "Generate Now"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onReject(slot.id)}>
            ✕
          </Button>
        </div>
      )}

      {slot.status === "done" && slot.articleId && (
        <Button size="sm" variant="outline" className="h-7 text-xs mt-1" asChild>
          <a href={`/app/articles?id=${slot.articleId}`}>View Article →</a>
        </Button>
      )}

      {slot.status === "failed" && (
        <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => onApprove(slot.id)}>
          Retry
        </Button>
      )}
    </div>
  );
}

function EditSlotModal({ slot, onSave, onClose }: {
  slot: AutopilotSlot;
  onSave: (updated: AutopilotSlot) => void;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState(slot.topic);
  const [keyword, setKeyword] = useState(slot.keyword);
  const [contentType, setContentType] = useState(slot.contentType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Edit Slot — Day {slot.day}</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{slot.date}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Article Topic / Title</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-[var(--surface-base)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Target Keyword</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-[var(--surface-base)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Content Type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-[var(--surface-base)] outline-none focus:border-[var(--border-focus)] cursor-pointer"
            >
              {Object.keys(CONTENT_TYPE_EMOJI).map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={() => onSave({ ...slot, topic, keyword, contentType })}>
            Save Changes
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export default function AutopilotPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<AutopilotSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSlotId, setGeneratingSlotId] = useState<string | null>(null);
  const [editSlot, setEditSlot] = useState<AutopilotSlot | null>(null);
  const [niche, setNiche] = useState("");
  const [audienceNote, setAudienceNote] = useState("");
  const [planCount, setPlanCount] = useState(30);
  const [filter, setFilter] = useState<"all" | AutopilotSlot["status"]>("all");
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);

  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch("/api/autopilot/queue");
      const data = await res.json();
      setSlots(data.slots ?? []);
      setNiche(data.niche ?? "");
      setAutopilotEnabled(data.enabled ?? false);
    } catch {
      toast.error("Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const handleGeneratePlan = async () => {
    if (!niche.trim()) {
      toast.error("Enter your niche first");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/autopilot/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, targetAudience: audienceNote, count: planCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlots(data.slots);
      toast.success(`Generated ${data.slots.length}-day content plan`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  };

  const updateSlotStatus = async (id: string, action: "approve" | "reject") => {
    await fetch("/api/autopilot/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, slotId: id }),
    });
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, status: action === "approve" ? "approved" : "rejected" } : s));
  };

  const handleApproveAll = async () => {
    await fetch("/api/autopilot/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_all" }),
    });
    setSlots((prev) => prev.map((s) => s.status === "pending" ? { ...s, status: "approved" } : s));
    toast.success("All pending slots approved");
  };

  const handleSaveEdit = async (updated: AutopilotSlot) => {
    await fetch("/api/autopilot/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_slot", slotId: updated.id, slots: [updated] }),
    });
    setSlots((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    setEditSlot(null);
    toast.success("Slot updated");
  };

  const handleGenerateSlot = async (slot: AutopilotSlot) => {
    setGeneratingSlotId(slot.id);
    setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, status: "generating" } : s));

    try {
      const res = await fetch("/api/generate/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: slot.topic,
          focusKeyword: slot.keyword,
          quality: "standard",
          withImages: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");

      const articleId = data.articleId ?? data.id ?? null;
      const updatedSlot: AutopilotSlot = { ...slot, status: "done", articleId };

      // Update in DB
      const currentSlots = slots.map((s) => s.id === slot.id ? updatedSlot : s);
      await fetch("/api/autopilot/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_plan", slots: currentSlots }),
      });

      setSlots(currentSlots);
      toast.success(`Article generated: "${slot.topic}"`);
    } catch (err) {
      setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, status: "failed" } : s));
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingSlotId(null);
    }
  };

  const toggleAutopilot = async () => {
    const next = !autopilotEnabled;
    setAutopilotEnabled(next);
    await fetch("/api/autopilot/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_enabled", enabled: next }),
    });
    toast.success(next ? "Autopilot enabled — articles will auto-generate as scheduled" : "Autopilot paused");
  };

  const filtered = filter === "all" ? slots : slots.filter((s) => s.status === filter);

  const stats = {
    total: slots.length,
    approved: slots.filter((s) => s.status === "approved").length,
    done: slots.filter((s) => s.status === "done").length,
    pending: slots.filter((s) => s.status === "pending").length,
    rejected: slots.filter((s) => s.status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Autopilot"
        description="Generate a 30-day content plan. Approve articles you want, then publish automatically."
        actions={
          slots.length > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--text-secondary)]">Auto-publish</span>
              <button
                onClick={toggleAutopilot}
                className="relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors"
                style={{ background: autopilotEnabled ? "var(--accent)" : "var(--border-strong)" }}
              >
                <span
                  className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200"
                  style={{ transform: autopilotEnabled ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Generate plan form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {slots.length === 0 ? "Generate Your 30-Day Content Plan" : "Regenerate Plan"}
          </CardTitle>
          <CardDescription>
            {slots.length === 0
              ? "Enter your niche and we'll generate a prioritized content calendar with keyword-targeted articles."
              : "Replace the current plan with a fresh set of keywords and topics."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Your niche or industry (e.g. SaaS email marketing)"
              className="flex-1 px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-[var(--surface-base)] outline-none focus:border-[var(--border-focus)]"
            />
            <input
              value={audienceNote}
              onChange={(e) => setAudienceNote(e.target.value)}
              placeholder="Target audience (optional)"
              className="flex-1 px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-[var(--surface-base)] outline-none focus:border-[var(--border-focus)]"
            />
            <div className="flex items-center gap-2">
              <select
                value={planCount}
                onChange={(e) => setPlanCount(Number(e.target.value))}
                className="px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-[var(--surface-base)] outline-none cursor-pointer"
              >
                <option value={7}>7 articles</option>
                <option value={14}>14 articles</option>
                <option value={30}>30 articles</option>
                <option value={60}>60 articles</option>
              </select>
              <Button onClick={handleGeneratePlan} loading={generating} disabled={!niche.trim()}>
                {slots.length === 0 ? "Generate Plan" : "Regenerate"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan exists */}
      {slots.length > 0 && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: stats.total, color: "text-[var(--text-primary)]" },
              { label: "Approved", value: stats.approved, color: "text-blue-600" },
              { label: "Published", value: stats.done, color: "text-green-600" },
              { label: "Pending", value: stats.pending, color: "text-[var(--text-secondary)]" },
            ].map((s) => (
              <div key={s.label} className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1 border-b border-[var(--border-default)]">
              {(["all", "pending", "approved", "done", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize",
                    filter === f
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {f === "all" ? `All (${stats.total})` : `${f} (${slots.filter((s) => s.status === f).length})`}
                </button>
              ))}
            </div>
            {stats.pending > 0 && (
              <Button size="sm" variant="outline" onClick={handleApproveAll}>
                Approve All ({stats.pending})
              </Button>
            )}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-secondary)] text-sm">
              No slots with status &quot;{filter}&quot;
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  onApprove={(id) => updateSlotStatus(id, "approve")}
                  onReject={(id) => updateSlotStatus(id, "reject")}
                  onEdit={setEditSlot}
                  onGenerate={handleGenerateSlot}
                  generatingId={generatingSlotId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {slots.length === 0 && !generating && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-sunken)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-medium text-[var(--text-primary)]">No content plan yet</p>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            Enter your niche above and generate a 30-day keyword-targeted content calendar.
          </p>
        </div>
      )}

      {/* Edit modal */}
      {editSlot && (
        <EditSlotModal
          slot={editSlot}
          onSave={handleSaveEdit}
          onClose={() => setEditSlot(null)}
        />
      )}
    </div>
  );
}
