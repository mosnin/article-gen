"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameDay, isToday, addMonths, parseISO,
} from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface PlannerSlot {
  id: string;
  day: number;
  date: string;
  keyword: string;
  topic: string;
  contentType: string;
  status: "pending" | "approved" | "rejected" | "generating" | "done" | "failed";
  articleId: string | null;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CONTENT_TYPE_COLORS: Record<string, string> = {
  "How-to Guide": "text-[var(--accent)] bg-[var(--accent-light)]",
  "Listicle": "text-amber-700 bg-amber-50",
  "Comparison": "text-purple-700 bg-purple-50",
  "Case Study": "text-green-700 bg-green-50",
  "Review": "text-blue-700 bg-blue-50",
  "Tutorial": "text-teal-700 bg-teal-50",
  "Ultimate Guide": "text-indigo-700 bg-indigo-50",
};

const CONTENT_TYPE_ABBREV: Record<string, string> = {
  "How-to Guide": "Guide: How-to",
  "Listicle": "List: Round-up",
  "Comparison": "Guide: Comparison",
  "Case Study": "Case Study",
  "Review": "Guide: Review",
  "Tutorial": "Guide: Tutorial",
  "Ultimate Guide": "Ultimate Guide",
};

// Deterministic estimates from keyword string
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function estimateVol(keyword: string): number {
  const vols = [70, 140, 170, 210, 260, 320, 360, 480, 590, 720, 880, 1000, 1200, 1600];
  return vols[hashStr(keyword) % vols.length];
}
function estimateDiff(keyword: string): number {
  return 7 + (hashStr(keyword + "d") % 24);
}

// Add Keyword Modal
function AddKeywordModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (keyword: string, topic: string, contentType: string, date: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("How-to Guide");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">Add Keyword</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Target Keyword</label>
            <input
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
              placeholder="e.g. best fitness apps for beginners"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Article Topic / Title</label>
            <input
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
              placeholder="Full article title"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Content Type</label>
              <select
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
              >
                {Object.keys(CONTENT_TYPE_ABBREV).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Publish Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              onClick={() => { if (keyword && topic) { onAdd(keyword, topic, contentType, date); onClose(); } }}
              disabled={!keyword || !topic}
            >
              Add to Planner
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  const router = useRouter();

  const [slots, setSlots] = useState<PlannerSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [monthsToShow] = useState(3);

  const months = Array.from({ length: monthsToShow }, (_, i) =>
    addMonths(startOfMonth(new Date()), i)
  );

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/autopilot/queue");
      const data = await res.json();
      if (res.ok) setSlots(data.slots ?? []);
    } catch {
      toast.error("Failed to load planner");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const slotsOnDay = (day: Date) =>
    slots.filter((s) => s.date && isSameDay(parseISO(s.date), day));

  const handleCreatePublish = async (slot: PlannerSlot) => {
    if (generatingId) return;
    setGeneratingId(slot.id);

    // First approve if pending
    if (slot.status === "pending") {
      await fetch("/api/autopilot/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", slotId: slot.id }),
      });
    }

    try {
      // Update status to generating
      const updatedSlots = slots.map((s) =>
        s.id === slot.id ? { ...s, status: "generating" as const } : s
      );
      setSlots(updatedSlots);

      const res = await fetch("/api/generate/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: slot.topic,
          keyword: slot.keyword,
          contentType: slot.contentType,
          quality: "standard",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const articleId = data.id ?? data.articleId ?? null;
      const finalSlots = slots.map((s) =>
        s.id === slot.id ? { ...s, status: "done" as const, articleId } : s
      );
      setSlots(finalSlots);

      // Persist to DB
      await fetch("/api/autopilot/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_plan", slots: finalSlots }),
      });

      toast.success("Article created!");
      if (articleId) router.push(`/app/articles/${articleId}`);
    } catch (e) {
      const failedSlots = slots.map((s) =>
        s.id === slot.id ? { ...s, status: "failed" as const } : s
      );
      setSlots(failedSlots);
      toast.error(e instanceof Error ? e.message : "Failed to generate article");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleAddKeyword = async (keyword: string, topic: string, contentType: string, date: string) => {
    const newSlot: PlannerSlot = {
      id: crypto.randomUUID(),
      day: slots.length + 1,
      date,
      keyword,
      topic,
      contentType,
      status: "pending",
      articleId: null,
    };
    const updated = [...slots, newSlot];
    setSlots(updated);
    await fetch("/api/autopilot/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_plan", slots: updated }),
    });
    toast.success("Keyword added to planner");
  };

  const handleGenerateKeywords = async () => {
    router.push("/app/autopilot");
  };

  const totalSlots = slots.length;
  const doneSlots = slots.filter((s) => s.status === "done").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Planner"
        description="Schedule and manage your articles for upcoming dates. Articles are sent to your blog at 7AM–9AM UTC."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[var(--accent)]">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Articles Plan: {totalSlots} scheduled
            </div>
            <Button variant="outline" size="sm" onClick={handleGenerateKeywords}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="mr-1.5 h-3.5 w-3.5">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Generate Keywords
            </Button>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="mr-1.5 h-3.5 w-3.5">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Keywords
            </Button>
          </div>
        }
      />

      {/* Trial/upgrade banner */}
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-blue-500">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <span className="flex-1">
          Articles with no integration connected are saved as drafts. Connect an integration to publish automatically.
        </span>
        <Button size="sm" variant="outline" className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100" onClick={() => router.push("/app/integrations")}>
          Connect Integration
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Scheduled", value: totalSlots },
          { label: "Published", value: doneSlots, green: true },
          { label: "Pending", value: slots.filter((s) => s.status === "pending").length },
          { label: "Approved", value: slots.filter((s) => s.status === "approved").length, accent: true },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-3">
            <p className="text-xs text-[var(--text-tertiary)]">{stat.label}</p>
            <p className={cn(
              "mt-0.5 text-xl font-semibold",
              stat.green ? "text-[var(--success)]" : stat.accent ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
            )}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-8">
          {[0, 1].map((mi) => (
            <div key={mi}>
              <Skeleton className="mb-4 h-7 w-36" />
              <div className="rounded-xl border border-[var(--border-default)]">
                <div className="grid grid-cols-7 border-b border-[var(--border-default)]">
                  {DAY_LABELS.map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-medium text-[var(--text-tertiary)]">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="min-h-[110px] border-b border-r border-[var(--border-default)] p-2 last:border-b-0">
                      <Skeleton className="mb-2 h-3 w-5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {months.map((monthStart) => {
            const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
            const calEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
            const days = eachDayOfInterval({ start: calStart, end: calEnd });

            return (
              <div key={monthStart.toISOString()}>
                <h2 className="mb-3 text-xl font-semibold text-[var(--text-primary)]">
                  {format(monthStart, "MMMM yyyy")}
                </h2>
                <div className="overflow-hidden rounded-xl border border-[var(--border-default)]">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 border-b border-[var(--border-default)] bg-[var(--surface-sunken)]">
                    {DAY_LABELS.map((d) => (
                      <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {days.map((day, i) => {
                      const daySlots = slotsOnDay(day);
                      const inMonth = day.getMonth() === monthStart.getMonth();
                      const today = isToday(day);
                      const isLast = i >= days.length - 7;

                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "min-h-[110px] border-b border-r border-[var(--border-default)] p-2",
                            !inMonth && "bg-[var(--surface-sunken)]",
                            isLast && "border-b-0",
                            (i + 1) % 7 === 0 && "border-r-0"
                          )}
                        >
                          {/* Date number */}
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                              today
                                ? "bg-[var(--accent)] text-white"
                                : inMonth
                                  ? "text-[var(--text-primary)]"
                                  : "text-[var(--text-tertiary)]"
                            )}>
                              {format(day, "d")}
                            </span>
                            {inMonth && (
                              <span className="text-[10px] lowercase font-normal text-[var(--text-tertiary)]">
                                {format(day, "EEE")}
                              </span>
                            )}
                          </div>

                          {/* Slots */}
                          <div className="space-y-1.5">
                            {daySlots.map((slot) => {
                              const typeColor = CONTENT_TYPE_COLORS[slot.contentType] ?? "text-[var(--text-secondary)] bg-[var(--surface-sunken)]";
                              const typeAbbrev = CONTENT_TYPE_ABBREV[slot.contentType] ?? slot.contentType;
                              const vol = estimateVol(slot.keyword);
                              const diff = estimateDiff(slot.keyword);
                              const isGenerating = generatingId === slot.id;
                              const isDone = slot.status === "done";

                              return (
                                <div
                                  key={slot.id}
                                  className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] p-2 shadow-sm"
                                >
                                  {/* Content type badge */}
                                  <div className={cn("mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none", typeColor)}>
                                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                                    {typeAbbrev}
                                  </div>

                                  {/* Topic */}
                                  <p className="mb-1.5 text-[11px] font-medium leading-snug text-[var(--text-primary)] line-clamp-2">
                                    {slot.topic}
                                  </p>

                                  {/* Vol / Diff */}
                                  {!isDone && (
                                    <div className="mb-1.5 flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
                                      <span>Vol: <strong className="text-[var(--text-secondary)]">{vol}</strong></span>
                                      <span>Diff: <strong className="text-[var(--text-secondary)]">{diff}</strong></span>
                                    </div>
                                  )}

                                  {/* Action button */}
                                  {isDone ? (
                                    <button
                                      onClick={() => slot.articleId && router.push(`/app/articles/${slot.articleId}`)}
                                      className="w-full rounded-md bg-[var(--success)] px-2 py-1 text-[10px] font-semibold text-white hover:opacity-90 transition-opacity"
                                    >
                                      View Article
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleCreatePublish(slot)}
                                      disabled={!!generatingId}
                                      className={cn(
                                        "w-full rounded-md px-2 py-1 text-[10px] font-semibold transition-opacity",
                                        isGenerating
                                          ? "bg-[var(--accent)] text-white opacity-70 cursor-not-allowed"
                                          : "bg-[var(--accent)] text-white hover:opacity-90"
                                      )}
                                    >
                                      {isGenerating ? "Generating…" : "Create & Publish"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && slots.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-light)]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-[var(--accent)]">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">No content scheduled yet</p>
          <p className="mb-4 text-xs text-[var(--text-secondary)]">
            Generate a content plan using Autopilot or add keywords manually.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/app/autopilot")}>Generate with Autopilot</Button>
            <Button variant="outline" onClick={() => setAddModalOpen(true)}>Add Keyword</Button>
          </div>
        </div>
      )}

      {addModalOpen && (
        <AddKeywordModal onClose={() => setAddModalOpen(false)} onAdd={handleAddKeyword} />
      )}
    </div>
  );
}
