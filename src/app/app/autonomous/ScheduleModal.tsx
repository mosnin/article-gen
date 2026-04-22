"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Schedule = {
  id?: string;
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  niche: string;
  tone?: string;
  targetAudience?: string;
  platforms?: Array<{ kind: string; id: string }>;
  status: "active" | "paused";
  nextRunAt?: string;
  // v2 fields
  timezone?: string;
  timeOfDayLocal?: string;
  weekdayMask?: number[];
  requiresApproval?: boolean;
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const DEFAULT_WEEKDAY_MASK: number[] = [1, 2, 3, 4, 5];

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function supportedTimezones(): string[] {
  try {
    // Intl.supportedValuesOf is Node ≥18 / modern browsers; fall back to a minimal set.
    const intlWithValues = Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    };
    if (typeof intlWithValues.supportedValuesOf === "function") {
      const list = intlWithValues.supportedValuesOf("timeZone");
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    // fall through
  }
  const browser = browserTimezone();
  const fallback = ["UTC"];
  return browser && browser !== "UTC" ? [browser, ...fallback] : fallback;
}

export function ScheduleModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Schedule | null;
  onSave: (s: Partial<Schedule>) => Promise<void>;
  onClose: () => void;
}) {
  const timezoneOptions = useMemo(() => supportedTimezones(), []);

  const [form, setForm] = useState<Schedule>({
    id: initial?.id,
    name: initial?.name ?? "",
    cadence: initial?.cadence ?? "weekly",
    niche: initial?.niche ?? "",
    tone: initial?.tone ?? "professional",
    targetAudience: initial?.targetAudience ?? "",
    platforms: initial?.platforms ?? [],
    status: initial?.status ?? "active",
    nextRunAt: initial?.nextRunAt ?? new Date().toISOString(),
    timezone: initial?.timezone ?? browserTimezone(),
    timeOfDayLocal: initial?.timeOfDayLocal ?? "09:00",
    weekdayMask: initial?.weekdayMask ?? DEFAULT_WEEKDAY_MASK,
    requiresApproval: initial?.requiresApproval ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformsText, setPlatformsText] = useState<string>(() => JSON.stringify(initial?.platforms ?? [], null, 2));
  const [platformsError, setPlatformsError] = useState<string | null>(null);

  useEffect(() => {
    setPlatformsText(JSON.stringify(initial?.platforms ?? [], null, 2));
    setPlatformsError(null);
  }, [initial?.id, initial?.platforms]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof Schedule>(k: K, v: Schedule[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleWeekday(day: number) {
    setForm((f) => {
      const current = f.weekdayMask ?? DEFAULT_WEEKDAY_MASK;
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b);
      return { ...f, weekdayMask: next };
    });
  }

  const activeMask = form.weekdayMask ?? DEFAULT_WEEKDAY_MASK;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          {initial ? "Edit schedule" : "New schedule"}
        </h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <Field label="Name" required>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              placeholder="e.g. SaaS growth weekly"
              className="w-full rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Niche / topic seed" required>
            <input
              value={form.niche}
              onChange={(e) => update("niche", e.target.value)}
              required
              className="w-full rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cadence">
              <select
                value={form.cadence}
                onChange={(e) => update("cadence", e.target.value as Schedule["cadence"])}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
              >
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
              </select>
            </Field>
            <Field label="Tone">
              <input
                value={form.tone ?? ""}
                onChange={(e) => update("tone", e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Target audience">
            <input
              value={form.targetAudience ?? ""}
              onChange={(e) => update("targetAudience", e.target.value)}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Timezone">
              <select
                value={form.timezone ?? "UTC"}
                onChange={(e) => update("timezone", e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </Field>
            <Field label="Time of day (local)">
              <input
                type="time"
                value={form.timeOfDayLocal ?? "09:00"}
                onChange={(e) => update("timeOfDayLocal", e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {form.cadence === "weekly" && (
            <Field label="Weekdays">
              <div className="flex items-center gap-1">
                {WEEKDAY_LABELS.map((label, i) => {
                  const on = activeMask.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={WEEKDAY_FULL[i]}
                      aria-pressed={on}
                      onClick={() => toggleWeekday(i)}
                      className={cn(
                        "h-8 w-8 rounded border text-xs font-medium",
                        on
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Platforms JSON (optional)">
            <textarea
              value={platformsText}
              onChange={(e) => {
                setPlatformsText(e.target.value);
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (!Array.isArray(parsed)) throw new Error("must be an array");
                  update("platforms", parsed);
                  setPlatformsError(null);
                } catch (err) {
                  setPlatformsError(err instanceof Error ? err.message : "invalid JSON");
                }
              }}
              rows={6}
              placeholder='[{"kind":"wordpress","id":"<blog-id>"}]'
              className="w-full rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 font-mono text-xs"
            />
            {platformsError && (
              <span className="text-[var(--error)] text-xs mt-1">{platformsError}</span>
            )}
          </Field>

          <label className="flex items-start gap-2 rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={!!form.requiresApproval}
              onChange={(e) => update("requiresApproval", e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-[var(--text-secondary)]">
              Requires human approval before dispatch
            </span>
          </label>

          {error && (
            <div className="rounded border border-[var(--error)] bg-[var(--error-light)] px-3 py-2 text-xs text-[var(--error)]">
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--surface-sunken)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                "hover:opacity-90 disabled:opacity-50",
              )}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--text-secondary)]">
        {label}{required && <span className="text-[var(--error)]"> *</span>}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
