"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

interface AppShellProps {
  title: string;
  children: React.ReactNode;
  onSignOut?: () => Promise<void> | void;
}

const NAV_ITEMS = [
  { label: "Generator", href: "/app" },
  { label: "Billing", href: "/app/billing" },
  { label: "Connected Blogs", href: "/app/connected-blogs" },
  { label: "Scheduler", href: "/app/scheduler" },
  { label: "Settings", href: "/app/settings" },
];

export default function AppShell({ title, children, onSignOut }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      {sidebarOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
        />
      )}

      <aside
        className={`fixed z-50 flex h-full w-[280px] flex-col border-r transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--sidebar-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-4"
          style={{ borderColor: "var(--card-border)" }}
        >
          <button onClick={() => router.push("/app")} className="flex items-center gap-2 text-left">
            <Image src="/logo.png" alt="Article Sauce" width={28} height={28} className="rounded" />
            <span className="text-sm font-semibold">Article Sauce</span>
          </button>

          <button
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className="rounded p-1 md:hidden"
            style={{ color: "var(--muted)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Workspace
          </p>
          <nav className="flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    setSidebarOpen(false);
                    router.push(item.href);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition"
                  style={{
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "#fff" : "var(--foreground)",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {onSignOut && (
          <div className="border-t p-3" style={{ borderColor: "var(--card-border)" }}>
            <button
              onClick={onSignOut}
              className="w-full rounded-lg px-3 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Sign Out
            </button>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 md:px-6"
          style={{ background: "var(--background)", borderColor: "var(--card-border)" }}
        >
          <button
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md border p-2 md:hidden"
            style={{ borderColor: "var(--card-border)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-base font-semibold">{title}</h1>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
