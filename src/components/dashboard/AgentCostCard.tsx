"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type CostBucket = {
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
};

type CostSummary = {
  day: CostBucket;
  week: CostBucket;
  month: CostBucket;
};

function formatUsd(value: number): string {
  // Up to 4 decimals when small; 2 decimals when >= 1.
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (value <= 0) return "$0.00";
  return `$${value.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function Cell({
  label,
  bucket,
  loading,
}: {
  label: string;
  bucket: CostBucket | null;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </span>
      {loading || !bucket ? (
        <>
          <div className="h-7 w-20 rounded bg-[var(--surface-sunken)] animate-pulse" />
          <div className="mt-1 h-3 w-28 rounded bg-[var(--surface-sunken)] animate-pulse" />
        </>
      ) : (
        <>
          <span className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
            {formatUsd(bucket.costUsd)}
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
            {formatTokens(bucket.tokensIn)} in &middot; {formatTokens(bucket.tokensOut)} out
          </span>
        </>
      )}
    </div>
  );
}

export function AgentCostCard({ className }: { className?: string }) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/agent/runs/cost-summary", { cache: "no-store" });
        const data = (await resp.json()) as Partial<CostSummary> & { error?: string };
        if (!resp.ok) {
          throw new Error(data.error ?? `load failed (${resp.status})`);
        }
        if (
          !cancelled &&
          data.day !== undefined &&
          data.week !== undefined &&
          data.month !== undefined
        ) {
          setSummary({ day: data.day, week: data.week, month: data.month });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)]",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Agent cost</h2>
        <span className="text-xs text-[var(--text-tertiary)]">USD &amp; tokens</span>
      </header>
      {error ? (
        <p className="p-4 text-sm text-[var(--error)]">{error}</p>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-[var(--border-default)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Cell label="Today" bucket={summary?.day ?? null} loading={isLoading} />
          <Cell label="Week" bucket={summary?.week ?? null} loading={isLoading} />
          <Cell label="Month" bucket={summary?.month ?? null} loading={isLoading} />
        </div>
      )}
    </section>
  );
}
