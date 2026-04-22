"use client";

import { cn } from "@/lib/utils";

export function StreamingCursor({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-3 w-[2px] animate-pulse bg-[var(--accent)]",
        className,
      )}
    />
  );
}
