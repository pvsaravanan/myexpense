import { describe, expect, it } from "vitest";
import {
  accountBalance,
  averageDailySpend,
  budgetStatus,
  categorySpend,
  categoryTotals,
  dailySeries,
  filterRange,
  monthlyContributionNeeded,
  monthsBetween,
  percentChange,
  summarize,
  totalBalance,
  type CalcTxn,
} from "./calculations";
import { toPaise } from "./money";

// Helper to build transactions concisely.
function tx(partial: Partial<CalcTxn> & Pick<CalcTxn, "type" | "amount">): CalcTxn {
  return {
    accountId: "a1",
    date: new Date(2026, 7, 15), // 15 Aug 2026
    ...partial,
  };
}

const rs = toPaise; // rupees -> paise

describe("summarize", () => {
  it("computes income, expense, net and savings rate", () => {
    const txns = [
      tx({ type: "income", amount: rs(65000) }),
      tx({ type: "expense", amount: rs(31420) }),
    ];
    const s = summarize(txns);
    expect(s.income).toBe(rs(65000));
    expect(s.grossExpense).toBe(rs(31420));
    expect(s.net).toBe(rs(33580));
    expect(s.savingsRate).toBeCloseTo(51.66, 1);
    expect(s.count).toBe(2);
  });

  it("treats refunds as reducing effective expense", () => {
    const txns = [
      tx({ type: "income", amount: rs(10000) }),
      tx({ type: "expense", amount: rs(4000) }),
      tx({ type: "refund", amount: rs(1000) }),
    ];
    const s = summarize(txns);
    expect(s.effectiveExpense).toBe(rs(3000));
    expect(s.net).toBe(rs(7000));
    expect(s.refunds).toBe(rs(1000));
  });

  it("does not count transfers as income or expense", () => {
    const txns = [
      tx({ type: "income", amount: rs(5000) }),
      tx({ type: "transfer", amount: rs(2000), accountId: "a1", transferAccountId: "a2" }),
    ];
    const s = summarize(txns);
    expect(s.income).toBe(rs(5000));
    expect(s.grossExpense).toBe(0);
    expect(s.transfersOut).toBe(rs(2000));
    expect(s.net).toBe(rs(5000));
  });

  it("handles zero income without dividing by zero", () => {
    const s = summarize([tx({ type: "expense", amount: rs(500) })]);
    expect(s.income).toBe(0);
    expect(s.savingsRate).toBe(0);
    expect(s.net).toBe(rs(-500));
  });

  it("ignores soft-deleted transactions", () => {
    const txns = [
      tx({ type: "income", amount: rs(1000) }),
      tx({ type: "expense", amount: rs(400), deletedAt: new Date() }),
    ];
    const s = summarize(txns);
    expect(s.grossExpense).toBe(0);
    expect(s.count).toBe(1);
  });

  it("handles large amounts safely (₹99,99,999)", () => {
    const s = summarize([tx({ type: "income", amount: rs(9999999) })]);
    expect(s.income).toBe(999999900);
  });
});

describe("accountBalance", () => {
  it("applies opening balance and income/expense", () => {
    const txns = [
      tx({ type: "income", amount: rs(1000), accountId: "a1" }),
      tx({ type: "expense", amount: rs(300), accountId: "a1" }),
    ];
    expect(accountBalance({ id: "a1", openingBalance: rs(500) }, txns)).toBe(rs(1200));
  });

  it("moves money between accounts on a transfer", () => {
    const txns = [tx({ type: "transfer", amount: rs(2000), accountId: "a1", transferAccountId: "a2" })];
    expect(accountBalance({ id: "a1", openingBalance: rs(5000) }, txns)).toBe(rs(3000));
    expect(accountBalance({ id: "a2", openingBalance: 0 }, txns)).toBe(rs(2000));
  });

  it("refunds increase account balance", () => {
    const txns = [tx({ type: "refund", amount: rs(250), accountId: "a1" })];
    expect(accountBalance({ id: "a1", openingBalance: 0 }, txns)).toBe(rs(250));
  });

  it("total balance is unchanged by internal transfers", () => {
    const accounts = [
      { id: "a1", openingBalance: rs(5000) },
      { id: "a2", openingBalance: rs(1000) },
    ];
    const txns = [tx({ type: "transfer", amount: rs(2000), accountId: "a1", transferAccountId: "a2" })];
    expect(totalBalance(accounts, txns)).toBe(rs(6000));
  });
});

describe("categoryTotals & categorySpend", () => {
  const txns = [
    tx({ type: "expense", amount: rs(6420), categoryId: "food" }),
    tx({ type: "expense", amount: rs(3250), categoryId: "transport" }),
    tx({ type: "refund", amount: rs(420), categoryId: "food" }),
    tx({ type: "income", amount: rs(50000), categoryId: "salary" }),
    tx({ type: "transfer", amount: rs(1000), categoryId: null, accountId: "a1", transferAccountId: "a2" }),
  ];

  it("only counts expenses and refunds, grouped by category", () => {
    const totals = categoryTotals(txns);
    const food = totals.find((t) => t.categoryId === "food")!;
    expect(food.expense).toBe(rs(6420));
    expect(food.refund).toBe(rs(420));
    expect(food.net).toBe(rs(6000));
    expect(totals.some((t) => t.categoryId === "salary")).toBe(false);
  });

  it("categorySpend nets refunds against expenses", () => {
    expect(categorySpend(txns, "food")).toBe(rs(6000));
    expect(categorySpend(txns, "transport")).toBe(rs(3250));
  });

  it("sorts categories by net spend descending", () => {
    const totals = categoryTotals(txns);
    expect(totals[0].categoryId).toBe("food");
  });
});

describe("budgetStatus", () => {
  it("reports remaining and under state", () => {
    const s = budgetStatus(rs(6420), rs(8000));
    expect(s.remaining).toBe(rs(1580));
    expect(s.state).toBe("under");
  });

  it("warns near the limit (>= 90%)", () => {
    expect(budgetStatus(rs(3250), rs(4000)).state).toBe("under"); // 81.25% is fine
    expect(budgetStatus(rs(3700), rs(4000)).state).toBe("warning"); // 92.5%
  });

  it("flags over budget", () => {
    const s = budgetStatus(rs(5420), rs(5000));
    expect(s.state).toBe("over");
    expect(s.remaining).toBe(rs(-420));
  });

  it("handles a zero limit", () => {
    expect(budgetStatus(rs(100), 0).utilization).toBe(Infinity);
    expect(budgetStatus(0, 0).state).toBe("under");
  });
});

describe("percentChange", () => {
  it("computes month-over-month deltas", () => {
    expect(percentChange(rs(120), rs(100))).toBeCloseTo(20);
    expect(percentChange(rs(80), rs(100))).toBeCloseTo(-20);
  });
  it("returns 0 when both are zero and null when previous is zero", () => {
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(rs(50), 0)).toBeNull();
  });
});

describe("date range filtering", () => {
  const txns = [
    tx({ type: "expense", amount: rs(100), date: new Date(2026, 6, 31) }), // 31 Jul
    tx({ type: "expense", amount: rs(200), date: new Date(2026, 7, 1) }), // 1 Aug (boundary)
    tx({ type: "expense", amount: rs(300), date: new Date(2026, 7, 31) }), // 31 Aug
    tx({ type: "expense", amount: rs(400), date: new Date(2026, 8, 1) }), // 1 Sep (boundary, excluded)
  ];
  it("is inclusive of start and exclusive of end", () => {
    const aug = filterRange(txns, new Date(2026, 7, 1), new Date(2026, 8, 1));
    expect(aug).toHaveLength(2);
    expect(summarize(aug).grossExpense).toBe(rs(500));
  });
  it("handles year boundaries", () => {
    const yearTxns = [
      tx({ type: "expense", amount: rs(100), date: new Date(2025, 11, 31) }), // 31 Dec 2025
      tx({ type: "expense", amount: rs(200), date: new Date(2026, 0, 1) }), // 1 Jan 2026
    ];
    const jan = filterRange(yearTxns, new Date(2026, 0, 1), new Date(2026, 1, 1));
    expect(jan).toHaveLength(1);
    expect(jan[0].amount).toBe(rs(200));
  });
});

describe("dailySeries", () => {
  it("fills every day and aggregates same-day transactions", () => {
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 4); // 3 days: Aug 1,2,3
    const txns = [
      tx({ type: "expense", amount: rs(100), date: new Date(2026, 7, 1) }),
      tx({ type: "expense", amount: rs(50), date: new Date(2026, 7, 1) }),
      tx({ type: "income", amount: rs(1000), date: new Date(2026, 7, 2) }),
    ];
    const series = dailySeries(txns, start, end);
    expect(series).toHaveLength(3);
    expect(series[0].expense).toBe(rs(150));
    expect(series[1].income).toBe(rs(1000));
    expect(series[2].expense).toBe(0);
  });

  it("covers leap-day February correctly", () => {
    const start = new Date(2024, 1, 1);
    const end = new Date(2024, 2, 1); // Feb 2024 has 29 days
    const series = dailySeries([], start, end);
    expect(series).toHaveLength(29);
  });
});

describe("goal math", () => {
  it("computes monthly contribution needed", () => {
    const today = new Date(2026, 0, 1);
    const target = new Date(2026, 6, 1); // 6 months away
    expect(monthlyContributionNeeded(rs(100000), rs(40000), today, target)).toBe(rs(10000));
  });
  it("returns 0 when goal already reached", () => {
    expect(monthlyContributionNeeded(rs(100000), rs(100000), new Date(), new Date())).toBe(0);
  });
  it("returns full remaining when no target date", () => {
    expect(monthlyContributionNeeded(rs(1000), rs(0), new Date(), null)).toBe(rs(1000));
  });
  it("monthsBetween respects boundaries and leap years", () => {
    expect(monthsBetween(new Date(2026, 0, 1), new Date(2026, 6, 1))).toBe(6);
    expect(monthsBetween(new Date(2024, 1, 29), new Date(2024, 2, 1))).toBe(1);
    expect(monthsBetween(new Date(2026, 5, 1), new Date(2026, 5, 1))).toBe(0);
  });
});

describe("averageDailySpend", () => {
  it("divides effective expense across the period days", () => {
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31); // 30 days
    expect(averageDailySpend(rs(31410), start, end)).toBe(rs(1047));
  });
});
