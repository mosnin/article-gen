"use client";

import { cn } from "@/lib/utils";

interface TopbarProps {
  title?: string;
  onMenuClick?: () => void;
  actions?: React.ReactNode;
}

export function Topbar({ title, onMenuClick, actions }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] items-center gap-3 border-b border-[var(--border-default)] bg-[var(--surface-base)]/90 backdrop-blur-sm px-4 lg:px-6">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="Open navigation"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      </button>

      {title && (
        <h1
          id="page-title"
          className={cn(
            "text-base font-semibold text-[var(--text-primary)] truncate",
            "lg:hidden" // Hide on desktop (shown in page header)
          )}
        >
          {title}
        </h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {actions}
      </div>
    </header>
  );
}
