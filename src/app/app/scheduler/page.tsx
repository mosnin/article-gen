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

export default function SchedulerPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [schedulers, setSchedulers] = useState<Record<string, Scheduler>>({});
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState("");

  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [quality, setQuality] = useState<"standard" | "premium">("premium");
  const [withImages, setWithImages] = useState(false);
  const [scheduleType, setScheduleType] = useState<"interval" | "calendar">("interval");
  const [scheduledFor, setScheduledFor] = useState("");
  const [jsonBatch, setJsonBatch] = useState("");
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
    if (!selectedBlogId && blogList.length) setSelectedBlogId(blogList[0].id);

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

  const filteredPosts = useMemo(
    () => (selectedBlogId ? posts.filter((p) => p.wp_blog_id === selectedBlogId) : posts),
    [posts, selectedBlogId]
  );

  const saveBlogScheduler = async (wpBlogId: string, intervalMinutes: number, active: boolean) => {
    const res = await fetch("/api/scheduler/blogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wpBlogId, intervalMinutes, active }),
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
    if (!selectedBlogId || !topic.trim()) return;
    const res = await fetch("/api/scheduler/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wpBlogId: selectedBlogId,
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
    load();
  };

  const addBatch = async () => {
    if (!selectedBlogId || !jsonBatch.trim()) return;
    let parsed: Array<{ concept?: string; topic?: string; keyword?: string }> = [];
    try {
      parsed = JSON.parse(jsonBatch);
      if (!Array.isArray(parsed)) throw new Error("Invalid format");
    } catch {
      setMessage("Batch JSON must be an array");
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
      body: JSON.stringify({ wpBlogId: selectedBlogId, items }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to add batch");
      return;
    }

    setJsonBatch("");
    setMessage(`Added ${data.count || items.length} items to scheduler queue`);
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
      <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <h2 className="text-lg font-semibold">Blog Scheduler</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Scheduler is blog-specific. General mode does not support scheduling.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select value={selectedBlogId} onChange={(e) => setSelectedBlogId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
            {blogs.map((blog) => (
              <option key={blog.id} value={blog.id}>{blog.name || blog.url}</option>
            ))}
          </select>

          <input
            type="number"
            min={15}
            defaultValue={schedulers[selectedBlogId]?.interval_minutes || 60}
            id="interval-minutes"
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--card-border)", background: "var(--background)" }}
          />

          <button
            onClick={() => {
              const input = document.getElementById("interval-minutes") as HTMLInputElement | null;
              saveBlogScheduler(selectedBlogId, Number(input?.value || 60), true);
            }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            Save Hourly/Interval Scheduler
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <h3 className="text-base font-semibold">Schedule single post (calendar or queue)</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic / concept" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }} />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword (optional)" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }} />
          <select value={quality} onChange={(e) => setQuality(e.target.value as "standard" | "premium")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
          <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as "interval" | "calendar")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
            <option value="interval">Queue (run by blog interval)</option>
            <option value="calendar">Calendar (specific date/time)</option>
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

      <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <h3 className="text-base font-semibold">Batch upload to scheduler queue</h3>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Same batch JSON format as dashboard batch mode (array with concept/topic + keyword).
        </p>
        <textarea value={jsonBatch} onChange={(e) => setJsonBatch(e.target.value)} rows={6} placeholder='[{"concept":"Cats for seniors","keyword":"senior cat care"}]' className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--background)" }} />
        <button onClick={addBatch} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--accent)" }}>
          Add Batch to Queue
        </button>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <h3 className="text-base font-semibold">Scheduled content</h3>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Shows all scheduled content. Filter by blog using the selector above.
        </p>
        <div className="mt-3 space-y-2">
          {filteredPosts.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>No scheduled items yet.</p>
          ) : (
            filteredPosts.map((post) => (
              <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
                <div>
                  <div className="text-sm font-medium">{post.topic}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {post.focus_keyword || "No keyword"} • {post.quality} • {post.schedule_type === "calendar" ? `at ${post.scheduled_for || "n/a"}` : `queue #${post.queue_order}`} • {post.status}
                  </div>
                </div>
                <button onClick={() => removePost(post.id)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--card-border)" }}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {message && <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>{message}</p>}
    </AppShell>
  );
}
