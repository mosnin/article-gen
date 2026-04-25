"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Platform =
  | "twitter"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "webhook";

const PLATFORMS: Platform[] = [
  "twitter",
  "linkedin",
  "instagram",
  "facebook",
  "webhook",
];

const PLATFORM_LABEL: Record<Platform, string> = {
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  webhook: "Webhook",
};

// Pill colour per platform - uses theme tokens.
const PLATFORM_PILL: Record<string, string> = {
  twitter:
    "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300",
  linkedin:
    "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300",
  instagram:
    "bg-pink-500/10 text-pink-700 border-pink-500/20 dark:text-pink-300",
  facebook:
    "bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:text-indigo-300",
  webhook:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  newsletter:
    "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
};

interface SocialAccountRow {
  id: string;
  user_id: string;
  platform: Platform;
  display_name: string | null;
  webhook_url: string | null;
  active: boolean;
  created_at: string;
}

interface ScheduledSnippetRow {
  id: string;
  user_id: string;
  article_id: string;
  platform: string;
  variant: string;
  body: string;
  hashtags: string[];
  scheduled_for: string;
  posted_at: string | null;
  external_url: string | null;
  created_at: string;
  article?: { id: string; title: string | null; slug: string | null } | null;
}

interface AccountFormState {
  id: string | null;
  platform: Platform;
  displayName: string;
  webhookUrl: string;
  active: boolean;
}

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  id: null,
  platform: "webhook",
  displayName: "",
  webhookUrl: "",
  active: true,
};

function PlatformPill({ platform }: { platform: string }) {
  const cls =
    PLATFORM_PILL[platform] ??
    "bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--border-default)]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        cls,
      )}
    >
      {platform}
    </span>
  );
}

export default function SocialIntegrationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [accounts, setAccounts] = useState<SocialAccountRow[]>([]);
  const [snippets, setSnippets] = useState<ScheduledSnippetRow[]>([]);

  // Form state for add/edit.
  const [form, setForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);
  const [savingAccount, setSavingAccount] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadData = useCallback(
    async (uid: string) => {
      setLoading(true);
      setError("");
      try {
        const { data: accountRows, error: e1 } = await supabase
          .from("social_accounts")
          .select(
            "id, user_id, platform, display_name, webhook_url, active, created_at",
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: false });
        if (e1) throw e1;
        setAccounts((accountRows ?? []) as SocialAccountRow[]);

        const { data: snippetRows, error: e2 } = await supabase
          .from("social_snippets")
          .select(
            "id, user_id, article_id, platform, variant, body, hashtags, scheduled_for, posted_at, external_url, created_at, article:articles(id, title, slug)",
          )
          .eq("user_id", uid)
          .not("scheduled_for", "is", null)
          .is("posted_at", null)
          .order("scheduled_for", { ascending: true });
        if (e2) throw e2;
        setSnippets((snippetRows ?? []) as unknown as ScheduledSnippetRow[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUserId(user.id);
      await loadData(user.id);
    };
    void init();
  }, [supabase, router, loadData]);

  const resetForm = () => setForm(EMPTY_ACCOUNT_FORM);

  const startEdit = (acc: SocialAccountRow) => {
    setForm({
      id: acc.id,
      platform: acc.platform,
      displayName: acc.display_name ?? "",
      webhookUrl: acc.webhook_url ?? "",
      active: acc.active,
    });
  };

  const onSaveAccount = async () => {
    if (!userId) return;
    if (form.displayName.trim().length === 0) {
      toast.error("Display name is required");
      return;
    }
    if (
      form.webhookUrl.trim().length > 0 &&
      !/^https?:\/\//i.test(form.webhookUrl.trim())
    ) {
      toast.error("Webhook URL must start with http:// or https://");
      return;
    }
    setSavingAccount(true);
    try {
      if (form.id) {
        const { error: e } = await supabase
          .from("social_accounts")
          .update({
            platform: form.platform,
            display_name: form.displayName.trim(),
            webhook_url: form.webhookUrl.trim() || null,
            active: form.active,
          })
          .eq("id", form.id)
          .eq("user_id", userId);
        if (e) throw e;
        toast.success("Account updated");
      } else {
        const { error: e } = await supabase.from("social_accounts").insert({
          user_id: userId,
          platform: form.platform,
          display_name: form.displayName.trim(),
          webhook_url: form.webhookUrl.trim() || null,
          active: form.active,
        });
        if (e) throw e;
        toast.success("Account added");
      }
      resetForm();
      await loadData(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingAccount(false);
    }
  };

  const onDeleteAccount = async (id: string) => {
    if (!userId) return;
    if (!confirm("Delete this connected account?")) return;
    try {
      const { error: e } = await supabase
        .from("social_accounts")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (e) throw e;
      toast.success("Account removed");
      await loadData(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const onPublishNow = async (snippet: ScheduledSnippetRow) => {
    if (!userId) return;
    setPublishingId(snippet.id);
    try {
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "social_publish",
          topic: "social publish",
          snippetIds: [snippet.id],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      toast.success("Publish queued");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishingId(null);
    }
  };

  const onCancelSchedule = async (snippet: ScheduledSnippetRow) => {
    if (!userId) return;
    setCancellingId(snippet.id);
    try {
      const { error: e } = await supabase
        .from("social_snippets")
        .update({ scheduled_for: null })
        .eq("id", snippet.id)
        .eq("user_id", userId);
      if (e) throw e;
      toast.success("Schedule cleared");
      await loadData(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Social publishing
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Connect your social destinations and publish scheduled snippets.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/5 px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* ──────────────── Connected accounts ──────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Connected accounts
          </h2>
          <span className="text-xs text-[var(--text-tertiary)]">
            {accounts.length} configured
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)]">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
              No accounts yet. Add one below.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-sunken)] text-left text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Platform</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Webhook URL</th>
                  <th className="px-3 py-2 font-medium">Active</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className="px-3 py-2">
                      <PlatformPill platform={acc.platform} />
                    </td>
                    <td className="px-3 py-2 text-[var(--text-primary)]">
                      {acc.display_name ?? "(unnamed)"}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      <span className="block max-w-[280px] truncate text-xs">
                        {acc.webhook_url ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          acc.active
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]",
                        )}
                      >
                        {acc.active ? "Active" : "Off"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(acc)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDeleteAccount(acc.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add / edit form */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {form.id ? "Edit account" : "Add account"}
            </h3>
            {form.id && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="platform">Platform</Label>
              <select
                id="platform"
                value={form.platform}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    platform: e.target.value as Platform,
                  }))
                }
                className="block w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                placeholder="e.g. @myhandle"
                value={form.displayName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="webhookUrl">
                Webhook URL{" "}
                <span className="text-[var(--text-tertiary)]">
                  (required for now - native OAuth posting is Phase 2)
                </span>
              </Label>
              <Input
                id="webhookUrl"
                placeholder="https://hooks.example.com/social"
                value={form.webhookUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, webhookUrl: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
                className="h-4 w-4 rounded border-[var(--border-default)]"
              />
              <Label htmlFor="active" className="text-sm">
                Active
              </Label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={onSaveAccount} disabled={savingAccount}>
              {savingAccount ? "Saving…" : form.id ? "Save changes" : "Add account"}
            </Button>
          </div>
        </div>
      </section>

      {/* ──────────────── Scheduled snippets ──────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Scheduled snippets
          </h2>
          <span className="text-xs text-[var(--text-tertiary)]">
            {snippets.length} scheduled
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)]">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : snippets.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
              No snippets scheduled.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-sunken)] text-left text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Platform</th>
                  <th className="px-3 py-2 font-medium">Body preview</th>
                  <th className="px-3 py-2 font-medium">Scheduled for</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {snippets.map((s) => {
                  const preview =
                    s.body.length > 120 ? `${s.body.slice(0, 117)}…` : s.body;
                  const when = new Date(s.scheduled_for);
                  const article = s.article ?? null;
                  const articleHref = article
                    ? `/app/articles/${article.id}`
                    : null;
                  return (
                    <tr key={s.id}>
                      <td className="px-3 py-2">
                        <PlatformPill platform={s.platform} />
                      </td>
                      <td className="px-3 py-2 text-[var(--text-primary)]">
                        <span className="block max-w-[420px] whitespace-pre-line text-xs leading-relaxed">
                          {preview}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">
                        <span className="text-xs">
                          {when.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {articleHref ? (
                          <Link
                            href={articleHref}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            {article?.title ?? "View article"}
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => onPublishNow(s)}
                            disabled={publishingId === s.id}
                          >
                            {publishingId === s.id ? "Queueing…" : "Publish now"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onCancelSchedule(s)}
                            disabled={cancellingId === s.id}
                          >
                            {cancellingId === s.id ? "…" : "Cancel"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
