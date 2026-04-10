"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface ScheduledArticle {
  id: string;
  title: string | null;
  topic: string;
  posted: boolean;
  scheduled_at: string | null;
  created_at: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ArticleStatus = "published" | "missed" | "scheduled";

function getStatus(article: ScheduledArticle): ArticleStatus {
  if (article.posted) return "published";
  if (article.scheduled_at && new Date(article.scheduled_at) < new Date()) return "missed";
  return "scheduled";
}

const STATUS_CLASSES: Record<ArticleStatus, string> = {
  published: "border-l-[var(--success)] bg-[var(--success-light,var(--surface-sunken))] text-[var(--text-primary)]",
  missed:    "border-l-[var(--error)]   bg-[var(--error-light,var(--surface-sunken))]   text-[var(--text-primary)]",
  scheduled: "border-l-[var(--accent)]  bg-[var(--accent-light)]                        text-[var(--text-primary)]",
};

const STATUS_DOT: Record<ArticleStatus, string> = {
  published: "bg-[var(--success)]",
  missed:    "bg-[var(--error)]",
  scheduled: "bg-[var(--accent)]",
};

const STATUS_LABEL: Record<ArticleStatus, string> = {
  published: "Published",
  missed:    "Missed",
  scheduled: "Scheduled",
};

export default function CalendarPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [articles, setArticles] = useState<ScheduledArticle[]>([]);
  const [unscheduled, setUnscheduled] = useState<ScheduledArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Schedule modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [modalArticle, setModalArticle] = useState<ScheduledArticle | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [platform, setPlatform] = useState("wordpress");
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      await loadArticles(user.id);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const loadArticles = async (userId: string) => {
    setLoading(true);
    setError("");
    try {
      const start = startOfMonth(currentMonth).toISOString();
      const end = endOfMonth(currentMonth).toISOString();

      const { data: scheduled, error: e1 } = await supabase
        .from("articles")
        .select("id, title, topic, posted, scheduled_at, created_at")
        .eq("user_id", userId)
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at");

      if (e1) throw e1;
      setArticles(scheduled ?? []);

      const { data: unsched } = await supabase
        .from("articles")
        .select("id, title, topic, posted, scheduled_at, created_at")
        .eq("user_id", userId)
        .eq("posted", false)
        .is("scheduled_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      setUnscheduled(unsched ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  };

  const calendarDays = (() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  })();

  const articlesOnDay = (day: Date) =>
    articles.filter((a) => a.scheduled_at && isSameDay(parseISO(a.scheduled_at), day));

  const openScheduleModal = (day: Date, existingArticle?: ScheduledArticle) => {
    setModalDate(day);
    setModalArticle(existingArticle ?? null);
    setSelectedArticleId(existingArticle?.id ?? (unscheduled[0]?.id ?? ""));
    setScheduleTime(existingArticle?.scheduled_at
      ? format(parseISO(existingArticle.scheduled_at), "HH:mm")
      : "09:00");
    setModalOpen(true);
  };

  const handleSchedule = async () => {
    if (!modalDate || !selectedArticleId) return;
    setScheduling(true);
    try {
      const [h, m] = scheduleTime.split(":").map(Number);
      const scheduledAt = new Date(modalDate);
      scheduledAt.setHours(h, m, 0, 0);

      const res = await fetch("/api/articles/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: selectedArticleId,
          scheduledAt: scheduledAt.toISOString(),
          platform,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scheduling failed");

      toast.success("Article scheduled successfully");
      setModalOpen(false);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) await loadArticles(user.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to schedule");
    } finally {
      setScheduling(false);
    }
  };

  const handleCancelSchedule = async (articleId: string) => {
    try {
      const res = await fetch("/api/articles/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Schedule cancelled");
      setModalOpen(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await loadArticles(user.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="Plan, schedule, and track your content publishing pipeline"
        actions={
          <Button onClick={() => openScheduleModal(new Date())}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Schedule Article
          </Button>
        }
      />

      <div className="flex gap-6">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-[var(--text-primary)]">
                  {format(currentMonth, "MMMM yyyy")}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    aria-label="Previous month"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                    className="text-xs px-2"
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    aria-label="Next month"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Day-of-week header row */}
              <div className="grid grid-cols-7 border-b border-[var(--border-default)]">
                {DAY_LABELS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-medium tracking-wide uppercase text-[var(--text-tertiary)]"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="grid grid-cols-7">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div
                      key={i}
                      className="min-h-[96px] border-b border-r border-[var(--border-default)] p-2"
                    >
                      <Skeleton className="h-5 w-5 rounded-full mb-2" />
                      <Skeleton className="h-3 w-full rounded mb-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const dayArticles = articlesOnDay(day);
                    const inMonth = isSameMonth(day, currentMonth);
                    const today = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => inMonth && openScheduleModal(day)}
                        className={cn(
                          "min-h-[96px] border-b border-r border-[var(--border-default)] p-2 transition-colors",
                          inMonth
                            ? "bg-[var(--surface-base)] cursor-pointer hover:bg-[var(--surface-sunken)]"
                            : "bg-[var(--surface-sunken)] cursor-default opacity-40",
                          today && "ring-2 ring-inset ring-[var(--accent)]"
                        )}
                      >
                        {/* Day number badge */}
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold mb-1.5",
                            today
                              ? "bg-[var(--accent)] text-white"
                              : "text-[var(--text-secondary)]"
                          )}
                        >
                          {format(day, "d")}
                        </span>

                        {/* Event pills */}
                        <div className="space-y-0.5">
                          {dayArticles.slice(0, 3).map((a) => {
                            const status = getStatus(a);
                            return (
                              <button
                                key={a.id}
                                onClick={(e) => { e.stopPropagation(); openScheduleModal(day, a); }}
                                title={a.title ?? a.topic}
                                className={cn(
                                  "w-full truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-opacity hover:opacity-80",
                                  STATUS_CLASSES[status]
                                )}
                              >
                                {a.title ?? a.topic}
                              </button>
                            );
                          })}
                          {dayArticles.length > 3 && (
                            <span className="block pl-1 text-[10px] text-[var(--text-tertiary)]">
                              +{dayArticles.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-5 text-xs text-[var(--text-secondary)]">
            {(["scheduled", "published", "missed"] as ArticleStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="hidden xl:flex xl:w-72 xl:flex-col gap-4 shrink-0">
          {/* Unscheduled articles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--text-primary)]">Unscheduled Articles</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {unscheduled.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-[var(--text-secondary)]">
                  All articles are scheduled or published.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-default)]">
                  {unscheduled.slice(0, 10).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <span className="truncate text-sm text-[var(--text-primary)]">
                        {a.title ?? a.topic}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedArticleId(a.id);
                          setModalDate(new Date());
                          setModalArticle(null);
                          setModalOpen(true);
                        }}
                        className="shrink-0 text-xs text-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        Schedule
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* This-month summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--text-primary)]">This Month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Scheduled</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {articles.filter((a) => !a.posted).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Published</span>
                <span className="font-medium text-[var(--success)]">
                  {articles.filter((a) => a.posted).length}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3 text-sm">
                <span className="text-[var(--text-secondary)]">Total</span>
                <span className="font-semibold text-[var(--text-primary)]">{articles.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule Modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
            >
              <Card className="shadow-modal border border-[var(--border-default)] bg-[var(--surface-raised)]">
                <CardHeader className="border-b border-[var(--border-default)] pb-4">
                  <CardTitle className="text-base text-[var(--text-primary)]">
                    {modalArticle
                      ? "Reschedule Article"
                      : `Schedule for ${modalDate ? format(modalDate, "MMMM d, yyyy") : ""}`}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  {/* Article selector (when scheduling new) */}
                  {!modalArticle && (
                    <div className="space-y-1.5">
                      <Label className="text-[var(--text-secondary)]">Article</Label>
                      <select
                        value={selectedArticleId}
                        onChange={(e) => setSelectedArticleId(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--border-focus,var(--accent))]"
                      >
                        <option value="">Select an article...</option>
                        {unscheduled.map((a) => (
                          <option key={a.id} value={a.id}>{a.title ?? a.topic}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Article display (when rescheduling) */}
                  {modalArticle && (
                    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2.5 text-sm text-[var(--text-primary)]">
                      {modalArticle.title ?? modalArticle.topic}
                    </div>
                  )}

                  {/* Date + Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[var(--text-secondary)]">Date</Label>
                      <Input
                        type="date"
                        value={modalDate ? format(modalDate, "yyyy-MM-dd") : ""}
                        onChange={(e) =>
                          setModalDate(e.target.value ? new Date(e.target.value + "T12:00:00") : null)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[var(--text-secondary)]">Time</Label>
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Platform */}
                  <div className="space-y-1.5">
                    <Label className="text-[var(--text-secondary)]">Platform</Label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--border-focus,var(--accent))]"
                    >
                      <option value="wordpress">WordPress</option>
                      <option value="ghost">Ghost</option>
                      <option value="medium">Medium</option>
                      <option value="devto">Dev.to</option>
                      <option value="shopify">Shopify</option>
                      <option value="webflow">Webflow</option>
                      <option value="notion">Notion</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-[var(--border-default)] pt-4">
                    <Button
                      onClick={handleSchedule}
                      loading={scheduling}
                      disabled={!selectedArticleId && !modalArticle}
                      className="flex-1"
                    >
                      {modalArticle ? "Reschedule" : "Schedule"}
                    </Button>
                    {modalArticle && (
                      <Button
                        variant="destructive"
                        onClick={() => handleCancelSchedule(modalArticle.id)}
                        className="flex-1"
                      >
                        Cancel Schedule
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setModalOpen(false)}>
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-[var(--border-error,var(--error))] bg-[var(--error-light,var(--surface-sunken))] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}
    </div>
  );
}
