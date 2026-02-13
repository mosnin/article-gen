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
  { label: "Settings", href: "/app/settings" },
];

export default function AppShell({ title, children, onSignOut }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = (
    <nav className="mt-6 flex flex-col gap-2">
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
              border: active ? "none" : "1px solid transparent",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {sidebarOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r p-4 transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--sidebar-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <button
          onClick={() => router.push("/app")}
          className="flex items-center gap-2 text-left"
        >
          <Image src="/logo.png" alt="Article Sauce" width={28} height={28} />
          <span className="text-sm font-semibold">Article Sauce</span>
        </button>

        {nav}

        {onSignOut && (
          <button
            onClick={onSignOut}
            className="mt-auto rounded-lg px-3 py-2 text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Sign Out
          </button>
        )}
      </aside>

      <div className="md:pl-64">
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

        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
