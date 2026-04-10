"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface BacklinkData {
  enabled: boolean;
  credits: number;
  totalBacklinks: number;
  uniqueSources: number;
  earnedBacklinks: Array<{
    id: string;
    sourceUrl: string;
    targetUrl: string;
    anchorText: string;
    dr: number;
    earnedAt: string;
  }>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-[var(--accent)]" : "bg-[var(--border-default)]"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function BacklinksPage() {
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState<BacklinkData>({
    enabled: false,
    credits: 100,
    totalBacklinks: 0,
    uniqueSources: 0,
    earnedBacklinks: [],
  });
  const [saving, setSaving] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data: settings } = await supabase
        .from("user_settings")
        .select("backlink_settings, plan")
        .eq("user_id", user.id)
        .single();

      if (settings?.backlink_settings) {
        setData((prev) => ({ ...prev, ...(settings.backlink_settings as Partial<BacklinkData>) }));
      }
      // Check plan
      const res = await fetch("/api/credits");
      const creds = await res.json();
      setIsPaid(!!(creds.plan && creds.plan !== "free"));
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleEnabled = async (val: boolean) => {
    if (!isPaid) {
      toast.error("Upgrade to enable backlink exchange");
      return;
    }
    setData((prev) => ({ ...prev, enabled: val }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_settings").upsert(
      { user_id: user.id, backlink_settings: { ...data, enabled: val } },
      { onConflict: "user_id" }
    );
    toast.success(val ? "Backlink exchange enabled" : "Backlink exchange disabled");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backlink Exchange"
        description="Track all the backlinks your website has earned through the backlink exchange network."
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
            <span className="font-medium">Your Domain Rating:</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">1</span>
            <span className="text-[var(--text-tertiary)]">Powered by Ahrefs</span>
          </div>
        }
      />

      {/* Trial upgrade banner */}
      {!isPaid && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--accent)]">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span className="flex-1 text-[var(--text-secondary)]">
            Trial accounts don&apos;t participate in Backlink Exchange and articles include Branding &bull; Upgrade to unlock full potential
          </span>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => router.push("/app/billing")}>
            Upgrade Now
          </Button>
        </div>
      )}

      {/* Exchange Settings */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)]">
        <div className="flex w-full items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--accent)]">
              <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
            </svg>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Exchange Settings</h2>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-0 border-t border-[var(--border-default)] divide-x divide-[var(--border-default)]">
          {/* Network Participation */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-1.5">
              <p className="text-xs font-semibold text-[var(--text-primary)]">Network Participation</p>
              <button aria-label="More information" className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">Enabled</span>
              <Toggle checked={data.enabled} onChange={toggleEnabled} />
            </div>
          </div>

          {/* Min Domain Rating */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-1.5">
              <p className="text-xs font-semibold text-[var(--text-primary)]">Min Domain Rating</p>
              <span className="rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">Now: DR 5</span>
            </div>
            <p className="mb-2 text-xs text-[var(--text-secondary)]">Choose a minimum DR level of websites where links will be placed</p>
            <button
              onClick={() => router.push("/app/billing")}
              className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Upgrade &rarr;
            </button>
          </div>

          {/* Link Targeting */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-1.5">
              <p className="text-xs font-semibold text-[var(--text-primary)]">Link Targeting</p>
            </div>
            <p className="mb-2 text-xs text-[var(--text-secondary)]">Choose and prioritize which pages on your site receive backlinks</p>
            <button
              onClick={() => router.push("/app/billing")}
              className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Upgrade &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Credits + Performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Backlink Credits */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--accent)]">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" clipRule="evenodd" />
              </svg>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Backlink Credits</h3>
              <button aria-label="More information" className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <button className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd" />
                <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z" />
              </svg>
              Get free credits
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="mb-0.5 text-[11px] text-[var(--text-tertiary)]">Credits Available</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{data.credits}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">1 Credit = 1 Domain Rating</p>
            </div>
            <div>
              <p className="mb-2 text-[11px] text-[var(--text-tertiary)]">Monthly Credits</p>
              <Button size="sm" className="rounded-full px-4">
                Get Monthly Credits &rarr;
              </Button>
              <p className="mt-1.5 text-[10px] text-[var(--text-tertiary)]">More credits = higher priority in exchange</p>
            </div>
          </div>
        </div>

        {/* Backlink Performance */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--accent)]">
              <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
            </svg>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Backlink Performance</h3>
            <button aria-label="More information" className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="mb-0.5 text-[11px] text-[var(--text-tertiary)]">Total Backlinks</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{data.totalBacklinks}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">All Time</p>
            </div>
            <div>
              <p className="mb-0.5 text-[11px] text-[var(--text-tertiary)]">Unique Sources</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{data.uniqueSources}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">Different Websites</p>
            </div>
          </div>
        </div>
      </div>

      {/* Earned Backlinks */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-5 py-4">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--accent-light)]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[var(--accent)]">
              <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Earned Backlinks</h3>
          <button aria-label="More information" className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {data.earnedBacklinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-sunken)]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-[var(--text-tertiary)]">
                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">No backlinks yet</p>
            <p className="max-w-xs text-xs text-[var(--text-secondary)]">
              You haven&apos;t received any backlinks yet. As you continue generating content, other websites in the network will link to yours.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.earnedBacklinks.map((bl) => (
              <div key={bl.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--surface-sunken)] transition-colors">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-xs font-bold text-[var(--accent)]">
                  {bl.dr}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[var(--text-primary)]">{bl.anchorText}</p>
                  <p className="truncate text-[10px] text-[var(--text-tertiary)]">{bl.sourceUrl}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                  {new Date(bl.earnedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
