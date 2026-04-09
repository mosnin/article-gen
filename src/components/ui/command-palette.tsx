"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemKind = "action" | "nav" | "article";

interface PaletteItem {
  id: string;
  kind: ItemKind;
  label: string;
  sublabel?: string;
  href?: string;
  action?: () => void;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Icons (inline SVG to keep the component self-contained)
// ---------------------------------------------------------------------------

function IconGenerate() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconAutopilot() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  );
}

function IconArticles() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconClusters() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
    </svg>
  );
}

function IconResearch() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconBilling() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path
        fillRule="evenodd"
        d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Static items
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: PaletteItem[] = [
  {
    id: "action-generate",
    kind: "action",
    label: "Generate Article",
    sublabel: "Create new AI-powered content",
    href: "/app/generate",
    icon: <IconGenerate />,
  },
  {
    id: "action-autopilot",
    kind: "action",
    label: "View Autopilot",
    sublabel: "Manage automated content schedules",
    href: "/app/autopilot",
    icon: <IconAutopilot />,
  },
  {
    id: "action-analytics",
    kind: "action",
    label: "View Analytics",
    sublabel: "Track content performance",
    href: "/app/analytics",
    icon: <IconAnalytics />,
  },
];

const NAV_ITEMS: PaletteItem[] = [
  {
    id: "nav-articles",
    kind: "nav",
    label: "Articles",
    href: "/app/articles",
    icon: <IconArticles />,
  },
  {
    id: "nav-clusters",
    kind: "nav",
    label: "Clusters",
    href: "/app/clusters",
    icon: <IconClusters />,
  },
  {
    id: "nav-research",
    kind: "nav",
    label: "Research",
    href: "/app/research",
    icon: <IconResearch />,
  },
  {
    id: "nav-settings",
    kind: "nav",
    label: "Settings",
    href: "/app/settings",
    icon: <IconSettings />,
  },
  {
    id: "nav-billing",
    kind: "nav",
    label: "Billing",
    href: "/app/billing",
    icon: <IconBilling />,
  },
];

// ---------------------------------------------------------------------------
// Fuzzy match helper
// ---------------------------------------------------------------------------

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lowerText.length && qi < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[qi]) qi++;
  }
  return qi === lowerQuery.length;
}

function itemMatchesQuery(item: PaletteItem, query: string): boolean {
  return (
    fuzzyMatch(item.label, query) ||
    (item.sublabel ? fuzzyMatch(item.sublabel, query) : false)
  );
}

// ---------------------------------------------------------------------------
// Section label component
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary,#94a3b8)] select-none">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RecentArticle {
  id: string;
  title: string;
  topic: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Open/close via Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  // Fetch recent articles when the palette opens
  useEffect(() => {
    if (!open) return;
    setLoadingArticles(true);
    const fetch = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("articles")
          .select("id, title, topic")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);
        setRecentArticles(data ?? []);
      } catch {
        // silent – palette is still usable without recent articles
      } finally {
        setLoadingArticles(false);
      }
    };
    fetch();
    // Auto-focus the input
    setTimeout(() => inputRef.current?.focus(), 0);
    // Reset state
    setQuery("");
    setActiveIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Build the flat list of items that pass the current query filter
  const articleItems: PaletteItem[] = recentArticles.map((a) => ({
    id: `article-${a.id}`,
    kind: "article" as ItemKind,
    label: a.title || "(Untitled)",
    sublabel: a.topic || undefined,
    href: `/app/articles`,
    icon: <IconDoc />,
  }));

  const filteredActions = QUICK_ACTIONS.filter((i) => itemMatchesQuery(i, query));
  const filteredNav = NAV_ITEMS.filter((i) => itemMatchesQuery(i, query));
  const filteredArticles = articleItems.filter((i) => itemMatchesQuery(i, query));

  // Build sections with headers for rendering, and a flat index list for keyboard nav
  type Section = { heading: string; items: PaletteItem[] };
  const sections: Section[] = [];
  if (filteredActions.length) sections.push({ heading: "Quick Actions", items: filteredActions });
  if (filteredNav.length) sections.push({ heading: "Navigate", items: filteredNav });
  if (filteredArticles.length) sections.push({ heading: "Recent Articles", items: filteredArticles });

  const flatItems = sections.flatMap((s) => s.items);

  // Clamp activeIndex when filter changes
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, flatItems.length - 1)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatItems.length]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const navigate = useCallback(
    (item: PaletteItem) => {
      setOpen(false);
      if (item.action) {
        item.action();
      } else if (item.href) {
        router.push(item.href);
      }
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems[activeIndex]) navigate(flatItems[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open) return null;

  // Helper: get the global flat index for an item (for active highlight)
  let globalIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed left-1/2 top-[20vh] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-base,#ffffff)] shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--border-default,#e2e8f0)] px-4 py-3">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-[var(--text-tertiary,#94a3b8)]"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search actions, pages, articles…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary,#0f172a)] placeholder:text-[var(--text-tertiary,#94a3b8)] focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-sunken,#f8fafc)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary,#94a3b8)] sm:inline-block">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto px-1.5 py-1.5"
        >
          {flatItems.length === 0 && !loadingArticles && (
            <p className="py-8 text-center text-sm text-[var(--text-tertiary,#94a3b8)]">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {sections.map((section) => (
            <div key={section.heading}>
              <SectionLabel>{section.heading}</SectionLabel>
              {section.items.map((item) => {
                const idx = globalIndex++;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    data-active={isActive}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigate(item)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-[var(--accent-light,#eff6ff)] text-[var(--accent,#3b82f6)]"
                        : "text-[var(--text-primary,#0f172a)] hover:bg-[var(--surface-sunken,#f8fafc)]"
                    }`}
                  >
                    {/* Icon container */}
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        isActive
                          ? "bg-[var(--accent,#3b82f6)] text-white"
                          : "bg-[var(--surface-sunken,#f1f5f9)] text-[var(--text-secondary,#475569)]"
                      }`}
                    >
                      {item.icon}
                    </span>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">
                        {item.label}
                      </p>
                      {item.sublabel && (
                        <p className="truncate text-[11px] text-[var(--text-tertiary,#94a3b8)] leading-tight mt-0.5">
                          {item.sublabel}
                        </p>
                      )}
                    </div>

                    {/* Kind badge */}
                    {item.kind === "article" && (
                      <span className="shrink-0 rounded-full bg-[var(--surface-sunken,#f1f5f9)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary,#94a3b8)]">
                        article
                      </span>
                    )}
                    {isActive && (
                      <kbd className="shrink-0 rounded border border-[var(--border-default,#e2e8f0)] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary,#94a3b8)]">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {loadingArticles && recentArticles.length === 0 && !query && (
            <div className="py-3 px-3">
              <SectionLabel>Recent Articles</SectionLabel>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-[var(--surface-sunken,#f1f5f9)]" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--surface-sunken,#f1f5f9)]" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--surface-sunken,#f1f5f9)]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-[var(--border-default,#e2e8f0)] px-4 py-2">
          <span className="text-[10px] text-[var(--text-tertiary,#94a3b8)]">
            <kbd className="rounded border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-sunken,#f8fafc)] px-1 py-0.5 font-mono">↑</kbd>{" "}
            <kbd className="rounded border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-sunken,#f8fafc)] px-1 py-0.5 font-mono">↓</kbd>{" "}
            Navigate
          </span>
          <span className="text-[10px] text-[var(--text-tertiary,#94a3b8)]">
            <kbd className="rounded border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-sunken,#f8fafc)] px-1.5 py-0.5 font-mono">↵</kbd>{" "}
            Open
          </span>
          <span className="ml-auto text-[10px] text-[var(--text-tertiary,#94a3b8)]">
            <kbd className="rounded border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-sunken,#f8fafc)] px-1.5 py-0.5 font-mono">Esc</kbd>{" "}
            Close
          </span>
        </div>
      </div>
    </>
  );
}
