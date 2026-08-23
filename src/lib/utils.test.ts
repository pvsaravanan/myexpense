import { describe, expect, it } from "vitest";
import { formatINR, formatINRCompact, groupIndian, toPaise, toRupees } from "./money";
import { guessMerchant, suggestCategory } from "./categorize";
import { advanceByFrequency, daysInMonth, fromISODate, isLeapYear, toISODate } from "./dates";
import { trailingIncreaseStreak } from "./insights";

describe("money", () => {
  it("converts rupees to paise without float error", () => {
    expect(toPaise(1250)).toBe(125000);
    expect(toPaise("1,250")).toBe(125000);
    expect(toPaise("₹1,00,000")).toBe(10000000);
    expect(toPaise(19.99)).toBe(1999);
    expect(toRupees(125000)).toBe(1250);
  });

  it("groups using the Indian numbering system", () => {
    expect(groupIndian(1000)).toBe("1,000");
    expect(groupIndian(100000)).toBe("1,00,000");
    expect(groupIndian(10000000)).toBe("1,00,00,000");
  });

  it("formats INR with sign and paise handling", () => {
    expect(formatINR(4258000)).toBe("₹42,580");
    expect(formatINR(125050)).toBe("₹1,250.50");
    expect(formatINR(-31420_00)).toBe("−₹31,420");
    expect(formatINR(500000, { showSign: true })).toBe("+₹5,000");
  });

  it("formats compact amounts", () => {
    expect(formatINRCompact(10000000)).toBe("₹1L");
    expect(formatINRCompact(150000000)).toBe("₹15L");
    expect(formatINRCompact(950000)).toBe("₹9.5k");
  });
});

describe("categorize", () => {
  it("suggests categories from common merchants", () => {
    expect(suggestCategory("Swiggy dinner")).toBe("Food");
    expect(suggestCategory("Uber to office")).toBe("Transportation");
    expect(suggestCategory("Netflix")).toBe("Subscriptions");
    expect(suggestCategory("College fee")).toBe("Education");
    expect(suggestCategory("BigBasket groceries")).toBe("Groceries");
    expect(suggestCategory("Amazon order")).toBe("Shopping");
    expect(suggestCategory("Jio recharge")).toBe("Bills & Utilities");
  });

  it("returns null when nothing matches", () => {
    expect(suggestCategory("xyzzy random note")).toBeNull();
    expect(suggestCategory("")).toBeNull();
  });

  it("guesses a merchant name", () => {
    expect(guessMerchant("Swiggy dinner")).toBe("Swiggy");
    expect(guessMerchant("paid Uber to office")).toBe("Uber");
  });
});

describe("dates", () => {
  it("knows leap years and month lengths", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
  });

  it("round-trips ISO dates in local time", () => {
    const d = fromISODate("2026-08-11")!;
    expect(toISODate(d)).toBe("2026-08-11");
    expect(fromISODate("2026-13-01")).toBeNull();
    expect(fromISODate("2026-02-30")).toBeNull();
  });

  it("advances by frequency, clamping month-end", () => {
    expect(toISODate(advanceByFrequency(fromISODate("2026-01-31")!, "monthly"))).toBe("2026-02-28");
    expect(toISODate(advanceByFrequency(fromISODate("2026-08-11")!, "weekly"))).toBe("2026-08-18");
    expect(toISODate(advanceByFrequency(fromISODate("2024-02-29")!, "yearly"))).toBe("2025-02-28");
    expect(toISODate(advanceByFrequency(fromISODate("2026-01-15")!, "quarterly"))).toBe("2026-04-15");
  });
});

describe("insights streak", () => {
  it("counts consecutive rising months", () => {
    expect(trailingIncreaseStreak([100, 200, 300])).toBe(3);
    expect(trailingIncreaseStreak([300, 100, 200, 300])).toBe(3);
    expect(trailingIncreaseStreak([100, 200, 150])).toBe(0);
    expect(trailingIncreaseStreak([100])).toBe(0);
  });
});
