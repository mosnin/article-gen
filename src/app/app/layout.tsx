"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { createClient } from "@/lib/supabase-browser";
import { Toaster } from "sonner";

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
      <Toaster position="top-right" richColors />
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
        <Topbar
          title={pageTitle}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 px-4 py-6 lg:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
