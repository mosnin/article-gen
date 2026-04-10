"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function LowCreditBanner() {
  const [credits, setCredits] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/credits/usage");
        if (res.ok) {
          const data = await res.json();
          setCredits(data.balance);
          setIsAdmin(data.isAdmin);
        }
      } catch {
        /* silent */
      }
    };
    fetchUsage();
  }, []);

  if (dismissed || isAdmin || credits === null || credits >= 3) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-sm text-red-400">
      <p>
        You have {credits} {credits === 1 ? "credit" : "credits"} remaining.{" "}
        <Link
          href="/app/billing"
          className="underline font-medium hover:text-red-300"
        >
          Upgrade Plan
        </Link>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-red-400 hover:text-red-300 transition-colors"
        aria-label="Dismiss low credit warning"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
