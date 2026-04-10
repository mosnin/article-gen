import { Skeleton } from "@/components/ui/skeleton";

/**
 * PageSkeleton — generic full-page loading placeholder.
 *
 * Renders (top to bottom):
 *  1. Header  — title bar + description bar
 *  2. Stat row — 4 stat-card skeletons in a responsive 2→4 column grid
 *  3. Table   — header row + 5 body rows, each with title, badge,
 *               two metadata columns, and an action button
 *
 * Uses the project's `.skeleton` shimmer class (globals.css) and
 * `bg-[var(--bg-hover)]` / `bg-[var(--surface-base)]` colour tokens
 * so it renders correctly in both light and dark themes.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Page title */}
        <Skeleton className="h-7 w-52 rounded-lg" />
        {/* Page description */}
        <Skeleton className="h-4 w-80 rounded" />
      </div>

      {/* ── Stat cards row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4 space-y-2"
          >
            {/* Large metric number */}
            <Skeleton className="h-7 w-14 rounded" />
            {/* Metric label */}
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        ))}
      </div>

      {/* ── Table skeleton ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
        {/* Fake thead */}
        <div className="border-b border-[var(--border-default)] bg-[var(--surface-sunken)] px-4 py-3 flex items-center gap-6">
          <Skeleton className="h-3 flex-1 rounded" />
          <Skeleton className="h-3 w-16 rounded hidden sm:block shrink-0" />
          <Skeleton className="h-3 w-20 rounded hidden md:block shrink-0" />
          <Skeleton className="h-3 w-16 rounded hidden lg:block shrink-0" />
          <Skeleton className="h-3 w-8 rounded shrink-0" />
        </div>

        {/* 5 body rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 px-4 py-3 border-b border-[var(--border-default)] last:border-0 bg-[var(--surface-base)]"
          >
            {/* Primary cell: title + sub-label */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton
                className="h-4 rounded"
                style={{ width: `${45 + (i % 4) * 13}%` }}
              />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            {/* Status badge */}
            <Skeleton className="h-5 w-16 rounded-full hidden sm:block shrink-0" />
            {/* Secondary value */}
            <Skeleton className="h-4 w-20 rounded hidden md:block shrink-0" />
            {/* Tertiary value (date) */}
            <Skeleton className="h-4 w-24 rounded hidden lg:block shrink-0" />
            {/* Action button */}
            <Skeleton className="h-7 w-12 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
