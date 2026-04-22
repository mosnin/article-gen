import { NextRequest } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase-server";
import { getAgentRun, listAgentEvents } from "@/lib/agent-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return new Response("unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const run = await getAgentRun(id);
  if (!run) return new Response("not_found", { status: 404 });
  if (run.user_id !== auth.user.id) return new Response("forbidden", { status: 403 });

  const encoder = new TextEncoder();
  let closed = false;
  let lastSeq = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // initial snapshot
      const fresh = await getAgentRun(id);
      if (fresh) send("run", fresh);
      const events = await listAgentEvents(id, 200);
      for (const ev of events) {
        send("step", ev);
        if (ev.seq > lastSeq) lastSeq = ev.seq;
      }

      const poll = async () => {
        while (!closed) {
          await new Promise((r) => setTimeout(r, 1500));
          if (closed) break;
          try {
            const latest = await getAgentRun(id);
            if (latest) send("run", latest);
            const next = await listAgentEvents(id, 200);
            for (const ev of next) {
              if (ev.seq > lastSeq) {
                send("step", ev);
                lastSeq = ev.seq;
              }
            }
            if (latest && ["succeeded", "failed", "cancelled"].includes(latest.status)) {
              send("done", { status: latest.status });
              controller.close();
              closed = true;
              break;
            }
          } catch {
            // swallow transient errors; keep polling until the client disconnects
          }
        }
      };
      poll().catch((e) => {
        try { controller.error(e); } catch {}
        closed = true;
      });
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
    },
  });
}
