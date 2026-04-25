"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentStream } from "@/components/agent-stream/AgentStream";
import { useAgentRun } from "@/hooks/useAgentRun";
import { cn } from "@/lib/utils";

export default function AgentRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { run, status, cancel } = useAgentRun(id);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryToast, setRetryToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const onCancel = useCallback(async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancel();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : String(e));
    } finally {
      setCancelling(false);
    }
  }, [cancel]);

  const onRetry = useCallback(async () => {
    setRetrying(true);
    setRetryToast(null);
    try {
      const resp = await fetch(`/api/agent/runs/${id}/retry`, { method: "POST" });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error ?? `retry failed (${resp.status})`);
      }
      setRetryToast({ kind: "success", message: "Retry dispatched. Redirecting..." });
      // The new run has a different id and Inngest needs to provision it,
      // so send the user back to the runs index.
      setTimeout(() => router.push("/app/agent-runs"), 800);
    } catch (e) {
      setRetryToast({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
      setRetrying(false);
    }
  }, [id, router]);

  const onComplete = useCallback((articleId: string | null) => {
    if (articleId) {
      // give the user a moment to see "completed" before redirect
      setTimeout(() => router.push(`/app/articles/${articleId}`), 1500);
    }
  }, [router]);

  const statusColor = {
    pending: "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]",
    running: "bg-[var(--accent-light)] text-[var(--accent)]",
    succeeded: "bg-[var(--success-light)] text-[var(--success)]",
    failed: "bg-[var(--error-light)] text-[var(--error)]",
    cancelled: "bg-[var(--surface-sunken)] text-[var(--text-secondary)]",
  }[status ?? "pending"];

  const canCancel = status === "pending" || status === "running";

  return (
    <div className="mx-auto max-w-5xl p-6">
      <nav className="mb-4 text-sm">
        <Link href="/app/agent-runs" className="text-[var(--text-tertiary)] hover:text-[var(--accent)]">
          ← Agent runs
        </Link>
      </nav>

      <header className="mb-6 rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {run?.topic ?? "Agent run"}
            </h1>
            {run?.focus_keyword && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Focus: <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-xs">
                  {run.focus_keyword}
                </code>
              </p>
            )}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusColor)}>
                {status ?? "loading"}
              </span>
              {run?.current_step && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  · {run.current_step}
                </span>
              )}
              {run?.current_agent && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  · {run.current_agent}
                </span>
              )}
              {typeof run?.cost_usd === "number" && run.cost_usd > 0 && (
                <>
                  <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    Tokens in: {run.tokens_in.toLocaleString()}
                  </span>
                  <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    Tokens out: {run.tokens_out.toLocaleString()}
                  </span>
                  <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    Cost: ${run.cost_usd.toFixed(4)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canCancel && (
              <button
                onClick={() => void onCancel()}
                disabled={cancelling}
                className={cn(
                  "rounded border border-[var(--border-default)] px-3 py-1.5 text-xs",
                  "hover:bg-[var(--surface-sunken)] disabled:opacity-50",
                )}
              >
                {cancelling ? "Cancelling..." : "Cancel run"}
              </button>
            )}
            {status === "failed" && (
              <button
                onClick={() => void onRetry()}
                disabled={retrying}
                className={cn(
                  "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                  "hover:opacity-90 disabled:opacity-50",
                )}
              >
                {retrying ? "Retrying..." : "Retry"}
              </button>
            )}
            {run?.article_id && (
              <Link
                href={`/app/articles/${run.article_id}`}
                className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Open article
              </Link>
            )}
          </div>
        </div>

        {cancelError && (
          <div className="mt-3 rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-3 py-2 text-xs text-[var(--error)]">
            {cancelError}
          </div>
        )}

        {retryToast && (
          <div
            className={cn(
              "mt-3 rounded-lg border px-3 py-2 text-xs",
              retryToast.kind === "success"
                ? "border-[var(--success)] bg-[var(--success-light)] text-[var(--success)]"
                : "border-[var(--error)] bg-[var(--error-light)] text-[var(--error)]",
            )}
          >
            {retryToast.message}
          </div>
        )}

        {typeof run?.progress_pct === "number" && run.progress_pct > 0 && (
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-[var(--surface-sunken)]">
              <div
                className="h-2 rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${Math.max(0, Math.min(100, run.progress_pct))}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
              {run.progress_pct}% complete
            </div>
          </div>
        )}
      </header>

      <AgentStream runId={id} onComplete={onComplete} />

      {run?.error && (
        <div className="mt-4 rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          <p className="font-medium">Run failed</p>
          <p className="mt-1">{run.error}</p>
        </div>
      )}
    </div>
  );
}
