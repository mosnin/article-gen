/**
 * Compute the next run time for an autonomous schedule, honouring the user's
 * IANA timezone, wall-clock time-of-day, and (for weekly cadence) a weekday
 * mask.
 *
 * The implementation uses plain JS Date arithmetic plus
 * `Intl.DateTimeFormat(timezone, {...}).formatToParts()` to project wall-clock
 * fields between UTC and the target timezone. It has no external dependencies.
 *
 * DST caveat: we snap to a target local wall-clock time and then project back
 * to UTC via a fixed-point search. In "spring forward" gaps (the 2:30am that
 * doesn't exist) we accept the first representable instant ≥ the nominal
 * moment; in "fall back" overlaps (the 1:30am that occurs twice) we pick the
 * first occurrence. This is good enough for hourly-resolution scheduling; a
 * schedule configured for the skipped hour will land on the hour immediately
 * after the DST boundary on that day.
 */

export type ScheduleCadence = "daily" | "weekly" | "monthly";

export type ComputeNextRunAtOpts = {
  timezone: string;
  timeOfDayLocal: string; // "HH:MM"
  cadence: ScheduleCadence;
  weekdayMask?: number[]; // 0=Sun..6=Sat
  from?: Date;
};

type LocalParts = {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun..6=Sat
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function hasIntlSupport(): boolean {
  try {
    return (
      typeof Intl !== "undefined" &&
      typeof Intl.DateTimeFormat === "function" &&
      typeof new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).formatToParts === "function"
    );
  } catch {
    return false;
  }
}

function parseHHMM(s: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return { hour: 9, minute: 0 };
  const hour = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const minute = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return { hour, minute };
}

function partsInTimezone(d: Date, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

/**
 * Return a UTC Date that, when viewed in `timezone`, has the requested
 * year/month/day/hour/minute. We start from a naive UTC guess and correct
 * for the tz offset at that instant — one correction is exact except across
 * a DST boundary, in which case a second pass converges.
 */
function utcFromLocalParts(
  target: { year: number; month: number; day: number; hour: number; minute: number },
  timezone: string,
): Date {
  // Initial guess: treat the target as if it were UTC.
  let utcMs = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, 0, 0);

  for (let i = 0; i < 2; i++) {
    const candidate = new Date(utcMs);
    const projected = partsInTimezone(candidate, timezone);
    const projectedMs = Date.UTC(
      projected.year, projected.month - 1, projected.day,
      projected.hour, projected.minute, 0, 0,
    );
    const targetMs = Date.UTC(
      target.year, target.month - 1, target.day, target.hour, target.minute, 0, 0,
    );
    const drift = projectedMs - targetMs;
    if (drift === 0) return candidate;
    utcMs -= drift;
  }
  return new Date(utcMs);
}

function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function addMonthsUtc(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

/**
 * Compute the next run instant as an ISO UTC string.
 */
export function computeNextRunAt(opts: ComputeNextRunAtOpts): string {
  const from = opts.from ?? new Date();
  const timezone = opts.timezone || "UTC";
  const { hour, minute } = parseHHMM(opts.timeOfDayLocal || "09:00");
  const mask = (opts.weekdayMask && opts.weekdayMask.length > 0)
    ? [...new Set(opts.weekdayMask.filter((n) => n >= 0 && n <= 6))]
    : [1, 2, 3, 4, 5];

  if (!hasIntlSupport()) {
    // Fallback: treat timezone as UTC with simple arithmetic.
    return fallbackComputeNextRun({
      cadence: opts.cadence,
      hour,
      minute,
      weekdayMask: mask,
      from,
    });
  }

  // Start: today (in tz) at HH:MM.
  const nowLocal = partsInTimezone(from, timezone);
  let candidate = utcFromLocalParts(
    { year: nowLocal.year, month: nowLocal.month, day: nowLocal.day, hour, minute },
    timezone,
  );

  // If candidate is in the past relative to `from`, advance by 1 day.
  if (candidate.getTime() <= from.getTime()) {
    const bumpedLocal = partsInTimezone(addDaysUtc(candidate, 1), timezone);
    candidate = utcFromLocalParts(
      { year: bumpedLocal.year, month: bumpedLocal.month, day: bumpedLocal.day, hour, minute },
      timezone,
    );
  }

  if (opts.cadence === "weekly") {
    // Advance day-by-day until weekday (in tz) is in the mask. Cap at 14 iters.
    for (let i = 0; i < 14; i++) {
      const cLocal = partsInTimezone(candidate, timezone);
      if (mask.includes(cLocal.weekday)) break;
      const nextLocal = partsInTimezone(addDaysUtc(candidate, 1), timezone);
      candidate = utcFromLocalParts(
        { year: nextLocal.year, month: nextLocal.month, day: nextLocal.day, hour, minute },
        timezone,
      );
    }
  } else if (opts.cadence === "monthly") {
    // Simpler: same day-of-month as `from` (in tz), next month, at HH:MM.
    const fromLocal = partsInTimezone(from, timezone);
    const target = addMonthsUtc(
      utcFromLocalParts(
        { year: fromLocal.year, month: fromLocal.month, day: fromLocal.day, hour, minute },
        timezone,
      ),
      1,
    );
    // Snap to the month boundary's configured HH:MM in tz.
    const targetLocal = partsInTimezone(target, timezone);
    candidate = utcFromLocalParts(
      { year: targetLocal.year, month: targetLocal.month, day: targetLocal.day, hour, minute },
      timezone,
    );
    if (candidate.getTime() <= from.getTime()) {
      // Defensive: edge case where "next month" still landed in the past.
      const bump = addMonthsUtc(candidate, 1);
      const bumpLocal = partsInTimezone(bump, timezone);
      candidate = utcFromLocalParts(
        { year: bumpLocal.year, month: bumpLocal.month, day: bumpLocal.day, hour, minute },
        timezone,
      );
    }
  }
  // daily: nothing further to do — today-or-tomorrow is the answer.

  return candidate.toISOString();
}

function fallbackComputeNextRun(args: {
  cadence: ScheduleCadence;
  hour: number;
  minute: number;
  weekdayMask: number[];
  from: Date;
}): string {
  const { cadence, hour, minute, weekdayMask, from } = args;
  const next = new Date(Date.UTC(
    from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour, minute, 0, 0,
  ));
  if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  if (cadence === "weekly") {
    for (let i = 0; i < 14; i++) {
      if (weekdayMask.includes(next.getUTCDay())) break;
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (cadence === "monthly") {
    next.setUTCFullYear(from.getUTCFullYear(), from.getUTCMonth() + 1, from.getUTCDate());
    next.setUTCHours(hour, minute, 0, 0);
    if (next.getTime() <= from.getTime()) next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next.toISOString();
}
