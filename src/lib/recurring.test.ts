import { describe, expect, it } from "vitest";
import { computeNextOccurrence, upcomingOccurrences } from "./recurring";
import { fromISODate, toISODate } from "./dates";

const d = (s: string) => fromISODate(s)!;

describe("computeNextOccurrence", () => {
  it("returns the start date when it is still in the future", () => {
    const next = computeNextOccurrence(d("2026-09-01"), "monthly", 1, d("2026-08-01"));
    expect(toISODate(next)).toBe("2026-09-01");
  });

  it("steps forward to the first occurrence at or after `from`", () => {
    const next = computeNextOccurrence(d("2026-01-10"), "monthly", 1, d("2026-08-05"));
    expect(toISODate(next)).toBe("2026-08-10");
  });

  it("treats an exact match as due (>= not >)", () => {
    const next = computeNextOccurrence(d("2026-01-10"), "monthly", 1, d("2026-08-10"));
    expect(toISODate(next)).toBe("2026-08-10");
  });

  it("honours a multi-unit interval", () => {
    const next = computeNextOccurrence(d("2026-01-01"), "monthly", 3, d("2026-08-01"));
    expect(toISODate(next)).toBe("2026-10-01"); // Jan, Apr, Jul, Oct
  });

  it("clamps month-end dates instead of overflowing", () => {
    const next = computeNextOccurrence(d("2026-01-31"), "monthly", 1, d("2026-02-15"));
    expect(toISODate(next)).toBe("2026-02-28");
  });

  it("handles weekly and yearly cadences", () => {
    expect(toISODate(computeNextOccurrence(d("2026-08-01"), "weekly", 1, d("2026-08-20")))).toBe("2026-08-22");
    expect(toISODate(computeNextOccurrence(d("2024-02-29"), "yearly", 1, d("2026-01-01")))).toBe("2026-02-28");
  });

  it("does not permanently drift the day-of-month after a short-month clamp", () => {
    // A "31st of every month" rule must clamp in Feb, then recover to the
    // 30th/31st in every month long enough to hold it — not stay pinned to 28.
    expect(toISODate(computeNextOccurrence(d("2026-01-31"), "monthly", 1, d("2026-02-01")))).toBe("2026-02-28");
    expect(toISODate(computeNextOccurrence(d("2026-01-31"), "monthly", 1, d("2026-03-01")))).toBe("2026-03-31");
    expect(toISODate(computeNextOccurrence(d("2026-01-31"), "monthly", 1, d("2026-04-01")))).toBe("2026-04-30");
  });

  it("recovers a leap-day yearly rule on the next leap year instead of staying at Feb 28", () => {
    expect(toISODate(computeNextOccurrence(d("2024-02-29"), "yearly", 1, d("2027-06-01")))).toBe("2028-02-29");
  });
});

describe("upcomingOccurrences", () => {
  const rule = {
    startDate: d("2026-01-05"),
    frequency: "monthly",
    interval: 1,
    endDate: null,
    nextOccurrence: d("2026-08-05"),
  };

  it("lists the next N occurrences from nextOccurrence", () => {
    const out = upcomingOccurrences(rule, d("2026-08-01"), 3).map(toISODate);
    expect(out).toEqual(["2026-08-05", "2026-09-05", "2026-10-05"]);
  });

  it("stops at endDate", () => {
    const bounded = { ...rule, endDate: d("2026-09-30") };
    const out = upcomingOccurrences(bounded, d("2026-08-01"), 5).map(toISODate);
    expect(out).toEqual(["2026-08-05", "2026-09-05"]);
  });

  it("skips occurrences before `from`", () => {
    const out = upcomingOccurrences(rule, d("2026-09-10"), 2).map(toISODate);
    expect(out).toEqual(["2026-10-05", "2026-11-05"]);
  });

  it("returns nothing when the rule already ended", () => {
    const ended = { ...rule, endDate: d("2026-07-01") };
    expect(upcomingOccurrences(ended, d("2026-08-01"), 3)).toHaveLength(0);
  });
});
