"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentRun, AgentEvent } from "@/lib/agent-runs";
import { createClient } from "@/lib/supabase-browser";

type Status = AgentRun["status"];
type Transport = "realtime" | "sse" | "connecting";

export type UseAgentRunResult = {
  run: AgentRun | null;
  events: AgentEvent[];
  isLoading: boolean;
  error: Error | null;
  status: Status | null;
  transport: Transport;
  cancel: () => Promise<void>;
};

const REALTIME_CONNECT_TIMEOUT_MS = 3000;

export function useAgentRun(runId: string | null): UseAgentRunResult {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [transport, setTransport] = useState<Transport>("connecting");
  const lastSeqRef = useRef<number>(0);

  const applyEvent = useCallback((ev: AgentEvent) => {
    if (ev.seq <= lastSeqRef.current) return;
    lastSeqRef.current = ev.seq;
    setEvents((prev) => [...prev, ev]);
  }, []);

  const applyRun = useCallback((r: AgentRun) => setRun(r), []);

  // 1. one-shot snapshot
  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/api/agent/runs/${runId}`, { cache: "no-store" });
        if (!resp.ok) throw new Error(`snapshot ${resp.status}`);
        const data = (await resp.json()) as { run: AgentRun; events: AgentEvent[] };
        if (cancelled) return;
        setRun(data.run);
        setEvents(data.events);
        if (data.events.length > 0) {
          lastSeqRef.current = data.events[data.events.length - 1].seq;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  // 2. Realtime subscription with SSE fallback
  useEffect(() => {
    if (!runId) return;
    const supabase = createClient();
    let usingFallback = false;
    let eventSource: EventSource | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    const openSse = () => {
      if (usingFallback) return;
      usingFallback = true;
      setTransport("sse");
      eventSource = new EventSource(`/api/agent/runs/${runId}/stream`);
      eventSource.addEventListener("run", (e) => {
        try { applyRun(JSON.parse((e as MessageEvent).data) as AgentRun); } catch {}
      });
      eventSource.addEventListener("step", (e) => {
        try { applyEvent(JSON.parse((e as MessageEvent).data) as AgentEvent); } catch {}
      });
      eventSource.addEventListener("done", () => { eventSource?.close(); });
      eventSource.onerror = () => { /* let SSE retry on its own schedule */ };
    };

    const channel = supabase
      .channel(`agent-run-${runId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_runs", filter: `id=eq.${runId}` },
        (payload) => applyRun(payload.new as AgentRun),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_events", filter: `run_id=eq.${runId}` },
        (payload) => applyEvent(payload.new as AgentEvent),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
          if (!usingFallback) setTransport("realtime");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          openSse();
        }
      });

    connectTimer = setTimeout(() => {
      if (transport === "connecting") openSse();
    }, REALTIME_CONNECT_TIMEOUT_MS);

    return () => {
      if (connectTimer) clearTimeout(connectTimer);
      supabase.removeChannel(channel);
      if (eventSource) eventSource.close();
    };
    // intentionally not including `transport` in deps — re-subscribing on transport
    // change would race with our own setTransport inside the same effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, applyEvent, applyRun]);

  const cancel = useCallback(async () => {
    if (!runId) return;
    const resp = await fetch(`/api/agent/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    if (!resp.ok) throw new Error(`cancel failed: ${resp.status}`);
  }, [runId]);

  return {
    run,
    events,
    isLoading,
    error,
    status: run?.status ?? null,
    transport,
    cancel,
  };
}
