// @ts-nocheck
// Supabase Edge Function: scheduler-run
// Purpose: claim due scheduled items (calendar + interval queues) per blog.
// NOTE: This function currently marks due posts as `processing` and advances next_run_at
// for interval schedulers. Hook your generation + publish pipeline where indicated.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface BlogScheduler {
  id: string;
  user_id: string;
  wp_blog_id: string;
  interval_minutes: number;
  active: boolean;
  next_run_at: string | null;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const nowIso = new Date().toISOString();

  // 1) Calendar posts due now
  const { data: dueCalendar } = await supabase
    .from("scheduled_posts")
    .select("id")
    .eq("status", "pending")
    .eq("schedule_type", "calendar")
    .lte("scheduled_for", nowIso)
    .limit(100);

  if (dueCalendar?.length) {
    const ids = dueCalendar.map((p) => p.id);
    await supabase
      .from("scheduled_posts")
      .update({ status: "processing", last_run_at: nowIso, updated_at: nowIso })
      .in("id", ids);
  }

  // 2) Interval schedulers due now: claim one queued item per due blog
  const { data: dueSchedulers } = await supabase
    .from("blog_schedulers")
    .select("*")
    .eq("active", true)
    .lte("next_run_at", nowIso)
    .limit(200);

  for (const scheduler of (dueSchedulers || []) as BlogScheduler[]) {
    const { data: nextPost } = await supabase
      .from("scheduled_posts")
      .select("id")
      .eq("user_id", scheduler.user_id)
      .eq("wp_blog_id", scheduler.wp_blog_id)
      .eq("status", "pending")
      .eq("schedule_type", "interval")
      .order("queue_order", { ascending: true })
      .limit(1)
      .single();

    if (nextPost?.id) {
      await supabase
        .from("scheduled_posts")
        .update({ status: "processing", last_run_at: nowIso, updated_at: nowIso })
        .eq("id", nextPost.id);

      const nextRun = new Date(Date.now() + scheduler.interval_minutes * 60_000).toISOString();
      await supabase
        .from("blog_schedulers")
        .update({ next_run_at: nextRun, updated_at: nowIso })
        .eq("id", scheduler.id);

      // TODO: invoke generation and publish pipeline here for nextPost.id.
    }
  }

  return new Response(JSON.stringify({ success: true, processedAt: nowIso }), {
    headers: { "Content-Type": "application/json" },
  });
});
