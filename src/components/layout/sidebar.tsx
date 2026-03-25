"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  exact?: boolean;
}

interface SidebarProps {
  credits?: number;
  plan?: string;
  userEmail?: string;
  isAdmin?: boolean;
  onSignOut?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-[var(--accent-light)] text-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center transition-colors",
          isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
        )}
      >
        {item.icon}
      </span>
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
      {!collapsed && item.badge !== undefined && (
        <span className="ml-auto rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white min-w-[18px] text-center">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  credits = 0,
  plan = "Free",
  userEmail = "",
  isAdmin = false,
  onSignOut,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const router = useRouter();

  const primaryNav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/app",
      exact: true,
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      ),
    },
    {
      label: "Generate",
      href: "/app/generate",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: "Articles",
      href: "/app/articles",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: "Clusters",
      href: "/app/clusters",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
  ];

  const secondaryNav: NavItem[] = [
    {
      label: "Settings",
      href: "/app/settings",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: "Billing",
      href: "/app/billing",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
          <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  if (isAdmin) {
    secondaryNav.push({
      label: "Admin",
      href: "/app/admin",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
        </svg>
      ),
    });
  }

  const creditPercent = Math.min(100, (credits / getPlanMax(plan)) * 100);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[var(--topbar-height)] shrink-0 items-center px-4 border-b border-[var(--border-default)]">
        <Link href="/app" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)]">
            <svg viewBox="0 0 20 20" fill="white" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">ArticleGen</span>
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
          Workspace
        </p>
        {primaryNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={false} />
        ))}

        <div className="mt-6 mb-1">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Account
          </p>
        </div>
        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={false} />
        ))}
      </nav>

      {/* Credits widget */}
      <div className="shrink-0 border-t border-[var(--border-default)] px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Credits</span>
          <span className="text-xs font-semibold text-[var(--text-primary)]">{credits} left</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--surface-sunken)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${creditPercent}%`,
              backgroundColor: creditPercent < 20 ? "var(--error)" : creditPercent < 50 ? "var(--warning)" : "var(--accent)",
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-tertiary)]">{plan} plan</span>
          {credits < 10 && (
            <Link href="/app/billing" className="text-[11px] text-[var(--accent)] hover:underline font-medium">
              Upgrade
            </Link>
          )}
        </div>

        {/* User */}
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors group"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold">
            {userEmail?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="truncate text-xs">{userEmail}</span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="ml-auto h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-[var(--sidebar-width)] lg:flex-col lg:fixed lg:inset-y-0 lg:z-30 bg-[var(--surface-raised)] border-r border-[var(--border-default)]">
        {sidebarContent}
      </div>

      {/* Mobile drawer backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-[var(--sidebar-width)] bg-[var(--surface-raised)] border-r border-[var(--border-default)] lg:hidden"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function getPlanMax(plan: string): number {
  const maxes: Record<string, number> = {
    Free: 10,
    Starter: 50,
    Growth: 150,
    Pro: 300,
  };
  return maxes[plan] ?? 10;
}
