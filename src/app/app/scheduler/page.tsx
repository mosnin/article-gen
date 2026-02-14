"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import AppShell from "@/components/app-shell";

interface Blog {
  id: string;
  name: string;
  url: string;
}

interface Scheduler {
  wp_blog_id: string;
  interval_minutes: number;
  active: boolean;
}

interface ScheduledPost {
  id: string;
  wp_blog_id: string;
  topic: string;
  focus_keyword: string;
  quality: "standard" | "premium";
  with_images: boolean;
  schedule_type: "interval" | "calendar";
  scheduled_for: string | null;
  queue_order: number;
  status: "pending" | "processing" | "completed" | "failed";
}

type ViewTab = "overview" | "queue" | "upload";

export default function SchedulerPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [schedulers, setSchedulers] = useState<Record<string, Scheduler>>({});
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState<string>("all");
  const [tab, setTab] = useState<ViewTab>("overview");

  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [quality, setQuality] = useState<"standard" | "premium">("premium");
  const [withImages, setWithImages] = useState(false);
  const [scheduleType, setScheduleType] = useState<"interval" | "calendar">("interval");
  const [scheduledFor, setScheduledFor] = useState("");
  const [jsonBatch, setJsonBatch] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.replace("/?auth=login");
      return;
    }

    const res = await fetch("/api/scheduler");
    const data = await res.json();

    const blogList = (data.blogs || []) as Blog[];
    setBlogs(blogList);

    if (selectedBlogId === "all" && blogList.length > 0) {
      // keep all for sorting view, but set a sane default interval source
      const first = blogList[0].id;
      const firstScheduler = (data.schedulers || []).find((s: Scheduler) => s.wp_blog_id === first);
      setIntervalMinutes(firstScheduler?.interval_minutes || 60);
    }

    const schedulerMap: Record<string, Scheduler> = {};
    for (const s of (data.schedulers || []) as Scheduler[]) {
      schedulerMap[s.wp_blog_id] = s;
    }

    setSchedulers(schedulerMap);
    setPosts((data.posts || []) as ScheduledPost[]);
    setLoading(false);
  }, [router, selectedBlogId, supabase.auth]);

  useEffect(() => {
    load();
  }, [load]);

  const activeBlogId = selectedBlogId === "all" ? (blogs[0]?.id || "") : selectedBlogId;

  const filteredPosts = useMemo(() => {
    const base = selectedBlogId === "all" ? posts : posts.filter((p) => p.wp_blog_id === selectedBlogId);
    return [...base].sort((a, b) => {
      if (selectedBlogId === "all" && a.wp_blog_id !== b.wp_blog_id) {
        return a.wp_blog_id.localeCompare(b.wp_blog_id);
      }
      if (a.schedule_type !== b.schedule_type) {
        return a.schedule_type === "calendar" ? -1 : 1;
      }
      if (a.schedule_type === "calendar") {
        return (a.scheduled_for || "").localeCompare(b.scheduled_for || "");
      }
      return a.queue_order - b.queue_order;
    });
  }, [posts, selectedBlogId]);

  const totalPending = posts.filter((p) => p.status === "pending").length;
  const totalCalendar = posts.filter((p) => p.schedule_type === "calendar").length;
  const totalInterval = posts.filter((p) => p.schedule_type === "interval").length;

  const saveBlogScheduler = async (wpBlogId: string, minutes: number, active: boolean) => {
    const res = await fetch("/api/scheduler/blogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wpBlogId, intervalMinutes: minutes, active }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to save scheduler");
      return;
    }
    setMessage("Scheduler updated");
    load();
  };

  const addSingle = async () => {
    if (!activeBlogId || !topic.trim()) {
      setMessage("Select a blog and enter a topic");
      return;
    }

    const res = await fetch("/api/scheduler/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wpBlogId: activeBlogId,
        items: [{
          topic,
          keyword,
          quality,
          withImages,
          scheduleType,
          scheduledFor: scheduleType === "calendar" ? scheduledFor || null : null,
        }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to add scheduled post");
      return;
    }

    setTopic("");
    setKeyword("");
    setScheduledFor("");
    setMessage("Scheduled item added");
    setTab("queue");
    load();
  };

  const addBatch = async () => {
    if (!activeBlogId || !jsonBatch.trim()) {
      setMessage("Select a blog and provide batch JSON");
      return;
    }

    let parsed: Array<{ concept?: string; topic?: string; keyword?: string }> = [];
    try {
      parsed = JSON.parse(jsonBatch);
      if (!Array.isArray(parsed)) throw new Error("Invalid format");
    } catch {
      setMessage("Batch JSON must be a valid array");
      return;
    }

    const items = parsed
      .map((item) => ({
        topic: (item.topic || item.concept || "").trim(),
        keyword: (item.keyword || "").trim(),
        quality,
        withImages,
        scheduleType: "interval" as const,
      }))
      .filter((i) => i.topic);

    if (!items.length) {
      setMessage("No valid items found in JSON");
      return;
    }

    const res = await fetch("/api/scheduler/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wpBlogId: activeBlogId, items }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to add batch");
      return;
    }

    setJsonBatch("");
    setMessage(`Added ${data.count || items.length} items to queue`);
    setTab("queue");
    load();
  };

  const removePost = async (id: string) => {
    await fetch("/api/scheduler/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) return <div className="p-6">Loading scheduler...</div>;

  return (
    <AppShell title="Scheduler" onSignOut={handleLogout}>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Pending", value: totalPending }, { label: "Calendar", value: totalCalendar }, { label: "Interval Queue", value: totalInterval }, { label: "Blogs", value: blogs.length }].map((card) => (
          <div key={card.label} className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
            <div className="text-xs" style={{ color: "var(--muted)" }}>{card.label}</div>
            <div className="mt-1 text-2xl font-semibold">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          { key: "overview", label: "Overview" },
          { key: "queue", label: "Scheduled Content" },
          { key: "upload", label: "Upload / Add" },
        ] as Array<{ key: ViewTab; label: string }>).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{
              background: tab === item.key ? "var(--accent)" : "var(--card)",
              color: tab === item.key ? "#fff" : "var(--foreground)",
              border: `1px solid var(--card-border)`,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Sort / Filter by blog</label>
          <select
            value={selectedBlogId}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedBlogId(next);
              if (next !== "all") setIntervalMinutes(schedulers[next]?.interval_minutes || 60);
            }}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--card-border)", background: "var(--background)" }}
          >
            <option value="all">All Blogs</option>
            {blogs.map((blog) => (
              <option key={blog.id} value={blog.id}>{blog.name || blog.url}</option>
            ))}
          </select>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            General mode is not supported for scheduler. Scheduling is always per connected blog.
          </span>
        </div>
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          {blogs.map((blog) => {
            const config = schedulers[blog.id];
            const blogPending = posts.filter((p) => p.wp_blog_id === blog.id && p.status === "pending").length;
            return (
              <div key={blog.id} className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{blog.name || blog.url}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{blog.url}</div>
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Pending: {blogPending}</div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={15}
                    value={selectedBlogId === blog.id ? intervalMinutes : config?.interval_minutes || 60}
                    onChange={(e) => {
                      setSelectedBlogId(blog.id);
                      setIntervalMinutes(Number(e.target.value || 60));
                    }}
                    className="w-36 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--card-border)", background: "var(--background)" }}
                  />
                  <button
                    onClick={() => saveBlogScheduler(blog.id, intervalMinutes, true)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    Save interval scheduler
                  </button>
                  <button
                    onClick={() => saveBlogScheduler(blog.id, config?.interval_minutes || 60, false)}
                    className="rounded-lg border px-3 py-2 text-sm font-medium"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    Disable
                  </button>
                  <span className="text-xs" style={{ color: config?.active ? "var(--success)" : "var(--muted)" }}>
                    {config?.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-6">
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
            <h3 className="text-base font-semibold">Add single scheduled item</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic / concept" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }} />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword (optional)" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }} />
              <select value={quality} onChange={(e) => setQuality(e.target.value as "standard" | "premium")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
              <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as "interval" | "calendar")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
                <option value="interval">Queue (every interval)</option>
                <option value="calendar">Calendar datetime</option>
              </select>
            </div>
            {scheduleType === "calendar" && (
              <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }} />
            )}
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} />
              Generate images when run
            </label>
            <button onClick={addSingle} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--accent)" }}>
              Add to Scheduler
            </button>
          </div>

          <div className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
            <h3 className="text-base font-semibold">Batch upload (same style as dashboard batch mode)</h3>
            <textarea value={jsonBatch} onChange={(e) => setJsonBatch(e.target.value)} rows={7} placeholder='[{"concept":"Cats for seniors","keyword":"senior cat care"}]' className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }} />
            <button onClick={addBatch} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--accent)" }}>
              Add Batch to Queue
            </button>
          </div>
        </div>
      )}

      {tab === "queue" && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
          <h3 className="text-base font-semibold">Scheduled content list</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Use the blog filter above to sort by blog, or view all blogs together.
          </p>
          <div className="mt-3 space-y-2">
            {filteredPosts.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>No scheduled items yet.</p>
            ) : (
              filteredPosts.map((post) => {
                const blog = blogs.find((b) => b.id === post.wp_blog_id);
                return (
                  <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
                    <div>
                      <div className="text-sm font-medium">{post.topic}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {(blog?.name || blog?.url || post.wp_blog_id)} • {post.focus_keyword || "No keyword"} • {post.quality} • {post.schedule_type === "calendar" ? `at ${post.scheduled_for || "n/a"}` : `queue #${post.queue_order}`} • {post.status}
                      </div>
                    </div>
                    <button onClick={() => removePost(post.id)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--card-border)" }}>
                      Remove
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {message && <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>{message}</p>}
    </AppShell>
  );
}
