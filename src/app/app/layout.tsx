"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/ui/command-palette";
import { createClient } from "@/lib/supabase-browser";
import { Toaster } from "sonner";
import { LowCreditBanner } from "./components/LowCreditBanner";

export const dynamic = "force-dynamic";

const PAGE_TITLES: Record<string, string> = {
  "/app": "Dashboard",
  "/app/generate": "Generate",
  "/app/articles": "Articles",
  "/app/clusters": "Clusters",
  "/app/calendar": "Content Calendar",
  "/app/research": "Keyword & Competitor Research",
  "/app/settings": "Settings",
  "/app/billing": "Billing",
  "/app/admin": "Admin",
  "/app/onboarding": "Onboarding",
  "/app/autopilot": "Content Autopilot",
  "/app/planner": "Content Planner",
  "/app/integrations": "Integrations",
  "/app/linking": "Linking Configuration",
  "/app/articles-settings": "Articles Settings",
  "/app/backlinks": "Backlink Exchange",
  "/app/free-tools": "Free Tools Builder",
  "/app/analytics": "Analytics",
  "/app/analytics/content-gaps": "Content Gap Analyzer",
  "/app/team": "Team",
  "/app/general-settings": "General Settings",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [credits, setCredits] = useState(0);
  const [plan, setPlan] = useState("Free");
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUserEmail(user.email ?? "");

      try {
        const res = await fetch("/api/credits");
        const data = await res.json();
        if (!data.error) {
          setCredits(data.credits ?? 0);
          setPlan(capitalize(data.plan ?? "free"));
          setIsAdmin(data.role === "admin");
        }
      } catch {
        /* silent */
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const pageTitle = PAGE_TITLES[pathname] ?? "";

  // Bare layout for onboarding
  if (pathname === "/app/onboarding") {
    return (
      <>
        <Toaster position="top-right" richColors />
        {children}
      </>
    );
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Toaster position="top-right" richColors />
      <CommandPalette />
      <Sidebar
        credits={credits}
        plan={plan}
        userEmail={userEmail}
        isAdmin={isAdmin}
        onSignOut={handleSignOut}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="lg:pl-[var(--sidebar-width)] flex min-h-screen flex-col">
        <LowCreditBanner />
        <Topbar
          title={pageTitle}
          onMenuClick={() => setMobileNavOpen(true)}
          actions={<CmdKHint />}
        />
        <main id="main-content" className="flex-1 px-4 py-6 lg:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CmdKHint() {
  return (
    <button
      type="button"
      onClick={() => {
        // Dispatch a synthetic keydown event to trigger the palette
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
        );
      }}
      aria-label="Open command palette (Cmd+K)"
      className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-strong,#cbd5e1)] transition-colors"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
      </svg>
      <span>Search</span>
      <kbd className="ml-0.5 rounded border border-[var(--border-default)] bg-[var(--surface-base)] px-1 py-0.5 font-mono text-[10px] leading-none">
        ⌘K
      </kbd>
    </button>
  );
}
