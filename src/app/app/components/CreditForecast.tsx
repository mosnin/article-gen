"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface UsageData {
  balance: number;
  usedLast7Days: number;
  usedLast30Days: number;
  dailyBurnRate: number;
  estimatedDaysRemaining: number | null;
  plan: string;
  monthlyAllocation: number;
  isAdmin: boolean;
}

export function CreditForecast() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/credits/usage");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Credit Usage Forecast
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { balance, dailyBurnRate, estimatedDaysRemaining, monthlyAllocation, isAdmin } = data;
  const percentage = monthlyAllocation > 0 ? (balance / monthlyAllocation) * 100 : 0;

  const barColor =
    percentage > 50
      ? "bg-green-500"
      : percentage > 20
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Credit Usage Forecast
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Balance and progress bar */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {isAdmin ? "\u221E" : balance}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              / {monthlyAllocation} monthly
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--surface-sunken)]">
            <div
              className={`h-2 rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>~{dailyBurnRate} credits/day</span>
          <span>
            {isAdmin
              ? "Unlimited"
              : estimatedDaysRemaining !== null
                ? `~${estimatedDaysRemaining} days remaining`
                : "No recent usage"}
          </span>
        </div>

        {/* Low credit warnings */}
        {!isAdmin && balance < 5 && balance >= 2 && (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
            Low credits remaining. Consider upgrading your plan.
          </div>
        )}

        {!isAdmin && balance < 2 && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            Credits almost depleted.{" "}
            <Link
              href="/app/billing"
              className="underline font-medium hover:text-red-300"
            >
              Upgrade Plan
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
