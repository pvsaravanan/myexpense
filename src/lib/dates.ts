/**
 * Date helpers. Financial periods are handled in local time. A "month key" is
 * { year, month(1-12) }. All range boundaries are inclusive-start / exclusive-end.
 */

export interface MonthKey {
  year: number;
  month: number; // 1-12
}

export interface DateRange {
  start: Date; // inclusive
  end: Date; // exclusive
}

export function monthKeyOf(date: Date): MonthKey {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Start of the given month (00:00:00.000 local). */
export function monthStart({ year, month }: MonthKey): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

/** Exclusive end of the given month == start of next month. */
export function monthEndExclusive({ year, month }: MonthKey): Date {
  return new Date(year, month, 1, 0, 0, 0, 0);
}

export function monthRange(key: MonthKey): DateRange {
  return { start: monthStart(key), end: monthEndExclusive(key) };
}

export function addMonths(key: MonthKey, delta: number): MonthKey {
  const zeroBased = key.month - 1 + delta;
  const year = key.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12;
  return { year, month: month + 1 };
}

export function prevMonth(key: MonthKey): MonthKey {
  return addMonths(key, -1);
}

export function nextMonth(key: MonthKey): MonthKey {
  return addMonths(key, 1);
}

/** Number of days in a given month (handles leap years). */
export function daysInMonth({ year, month }: MonthKey): number {
  return new Date(year, month, 0).getDate();
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel({ year, month }: MonthKey, opts: { short?: boolean } = {}): string {
  const name = MONTH_NAMES[month - 1];
  return `${opts.short ? name.slice(0, 3) : name} ${year}`;
}

export function monthName(month: number, short = false): string {
  const n = MONTH_NAMES[month - 1] ?? "";
  return short ? n.slice(0, 3) : n;
}

/** "2026-08" key string, useful as a stable identifier / URL param. */
export function monthKeyString({ year, month }: MonthKey): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(s: string | null | undefined): MonthKey | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** Format a Date as YYYY-MM-DD in local time (for <input type=date> and CSV). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string into a local Date at midnight. Returns null if invalid. */
export function fromISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDayExclusive(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

const DISPLAY_MONTHS = MONTH_NAMES.map((m) => m.slice(0, 3));

/** Human date like "11 Aug 2026". */
export function formatDate(date: Date, opts: { withYear?: boolean } = {}): string {
  const { withYear = true } = opts;
  const d = date.getDate();
  const m = DISPLAY_MONTHS[date.getMonth()];
  return withYear ? `${d} ${m} ${date.getFullYear()}` : `${d} ${m}`;
}

/** Relative-ish label: Today / Yesterday / weekday / full date. */
export function formatRelativeDay(date: Date, now: Date): string {
  const a = startOfDay(date).getTime();
  const b = startOfDay(now).getTime();
  const diffDays = Math.round((b - a) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays === -1) return "Tomorrow";
  return formatDate(date, { withYear: date.getFullYear() !== now.getFullYear() });
}

/**
 * Advance a date by a recurrence frequency. Used to compute the next occurrence
 * of a recurring transaction. Keeps day-of-month stable where possible.
 */
export function advanceByFrequency(
  date: Date,
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
  interval = 1,
): Date {
  const d = new Date(date.getTime());
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + interval);
      return d;
    case "weekly":
      d.setDate(d.getDate() + 7 * interval);
      return d;
    case "monthly":
      return addMonthsToDate(d, interval);
    case "quarterly":
      return addMonthsToDate(d, 3 * interval);
    case "yearly":
      return addMonthsToDate(d, 12 * interval);
  }
}

/** Add months to a Date, clamping the day to the target month's length. */
export function addMonthsToDate(date: Date, months: number): Date {
  const targetMonthIndex = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const day = Math.min(date.getDate(), lastDay);
  return new Date(targetYear, normalizedMonth, day, date.getHours(), date.getMinutes(), 0, 0);
}

/**
 * The nth occurrence (0-indexed; n=0 is `startDate` itself) of a recurrence
 * rule, computed directly from `startDate` rather than by repeatedly
 * advancing the previous occurrence.
 *
 * This matters for monthly/quarterly/yearly cadences: `addMonthsToDate`
 * clamps an out-of-range day (e.g. the 31st in February) to the target
 * month's last day. Chaining — advancing occurrence N+1 from the *clamped*
 * occurrence N — makes that clamp permanent: a "31st of every month" rule
 * would drift to the 28th after February and never recover. Anchoring every
 * occurrence back to the original `startDate` means the clamp only applies
 * to months that are actually too short, and the rule lands back on the
 * intended day (e.g. Mar 31, or Feb 29 on the next leap year) as soon as the
 * target month is long enough again.
 */
export function occurrenceAt(
  startDate: Date,
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
  interval: number,
  n: number,
): Date {
  const start = startOfDay(startDate);
  switch (frequency) {
    case "daily": {
      const d = new Date(start);
      d.setDate(d.getDate() + interval * n);
      return d;
    }
    case "weekly": {
      const d = new Date(start);
      d.setDate(d.getDate() + interval * n * 7);
      return d;
    }
    case "monthly":
      return addMonthsToDate(start, interval * n);
    case "quarterly":
      return addMonthsToDate(start, interval * n * 3);
    case "yearly":
      return addMonthsToDate(start, interval * n * 12);
  }
}

/**
 * Smallest occurrence index n (>= 0) such that `occurrenceAt(startDate, ...,
 * n)` is at or after `target`. `occurrenceAt` is monotonically non-decreasing
 * in n, so this is a binary search after an exponential search for an upper
 * bound — correct and fast even for rules that are decades overdue.
 */
export function findOccurrenceIndex(
  startDate: Date,
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
  interval: number,
  target: Date,
): number {
  const start = startOfDay(startDate);
  const targetTime = startOfDay(target).getTime();
  if (start.getTime() >= targetTime) return 0;

  let lo = 0;
  let hi = 1;
  while (occurrenceAt(start, frequency, interval, hi).getTime() < targetTime) {
    lo = hi;
    hi *= 2;
    if (hi > 1_000_000) break; // safety cap — matches the old 10k-iteration guard's intent
  }
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (occurrenceAt(start, frequency, interval, mid).getTime() < targetTime) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Inclusive count of days between two dates (by calendar day). */
export function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}
