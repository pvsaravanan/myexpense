/**
 * Deterministic financial insights. Every statement is derived from real
 * aggregates — no AI, no fabricated numbers. If a condition isn't met, the
 * insight simply isn't produced.
 */
import type { CategoryTotal, PeriodSummary } from "./calculations";
import { budgetStatus, percentChange } from "./calculations";
import { formatINR, formatPercent } from "./money";

export type InsightTone = "neutral" | "positive" | "warning" | "info";

export interface Insight {
  id: string;
  tone: InsightTone;
  icon: string;
  text: string;
}

export interface InsightInput {
  current: PeriodSummary;
  previous: PeriodSummary;
  currentCategories: CategoryTotal[];
  previousCategories: CategoryTotal[];
  categoryNames: Map<string, string>;
  /** Effective expense per month, oldest → newest, including the current month. */
  monthlyExpenseTrend: number[];
  overallBudgetLimit: number | null;
  avgDailySpend: number;
  subscriptionSpend: number;
}

export function generateInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const {
    current,
    previous,
    currentCategories,
    previousCategories,
    categoryNames,
    monthlyExpenseTrend,
    overallBudgetLimit,
    avgDailySpend,
    subscriptionSpend,
  } = input;

  const nameOf = (id: string | null) => (id ? categoryNames.get(id) ?? "Uncategorized" : "Uncategorized");

  // Top category as a share of spending.
  const topCat = currentCategories[0];
  if (topCat && current.effectiveExpense > 0 && topCat.net > 0) {
    // effectiveExpense is the net across all categories, so a refund-heavy
    // category with negative net can shrink the denominator below topCat.net
    // and push the share above 100%. Clamp to a sane [0,100] range.
    const share = Math.min(100, (topCat.net / current.effectiveExpense) * 100);
    out.push({
      id: "top-category-share",
      tone: "info",
      icon: "pie-chart",
      text: `${nameOf(topCat.categoryId)} accounts for ${formatPercent(share)} of your spending this month.`,
    });
  }

  // Biggest category change vs last month. Iterate the UNION of both months'
  // categories, not just this month's — otherwise a category with heavy spend
  // last month and none this month (delta = -prev, often the largest swing) is
  // never even considered.
  const currMap = new Map(currentCategories.map((c) => [c.categoryId, c.net]));
  const prevMap = new Map(previousCategories.map((c) => [c.categoryId, c.net]));
  let biggestJump: { id: string | null; delta: number } | null = null;
  for (const catId of new Set([...currMap.keys(), ...prevMap.keys()])) {
    const delta = (currMap.get(catId) ?? 0) - (prevMap.get(catId) ?? 0);
    if (!biggestJump || Math.abs(delta) > Math.abs(biggestJump.delta)) {
      biggestJump = { id: catId, delta };
    }
  }
  if (biggestJump && Math.abs(biggestJump.delta) >= 50_000) {
    const up = biggestJump.delta > 0;
    out.push({
      id: "category-change",
      tone: up ? "warning" : "positive",
      icon: up ? "trending-up" : "trending-down",
      text: `You spent ${formatINR(Math.abs(biggestJump.delta))} ${up ? "more" : "less"} on ${nameOf(
        biggestJump.id,
      )} this month than last month.`,
    });
  }

  // Overall expense change vs last month.
  const expenseDelta = percentChange(current.effectiveExpense, previous.effectiveExpense);
  if (expenseDelta !== null && Math.abs(expenseDelta) >= 5 && previous.effectiveExpense > 0) {
    const up = expenseDelta > 0;
    out.push({
      id: "expense-trend",
      tone: up ? "warning" : "positive",
      icon: up ? "arrow-up-right" : "arrow-down-right",
      text: `Your total spending is ${formatPercent(Math.abs(expenseDelta))} ${
        up ? "higher" : "lower"
      } than last month.`,
    });
  }

  // Consecutive months of rising spend.
  const streak = trailingIncreaseStreak(monthlyExpenseTrend);
  if (streak >= 3) {
    out.push({
      id: "rising-streak",
      tone: "warning",
      icon: "flame",
      text: `Your spending has increased for ${streak} consecutive months.`,
    });
  }

  // Budget utilization.
  if (overallBudgetLimit && overallBudgetLimit > 0) {
    const status = budgetStatus(current.effectiveExpense, overallBudgetLimit);
    if (status.state === "over") {
      out.push({
        id: "budget-over",
        tone: "warning",
        icon: "alert-triangle",
        text: `You are ${formatINR(-status.remaining)} over your monthly budget.`,
      });
    } else {
      out.push({
        id: "budget-usage",
        tone: status.utilization >= 90 ? "warning" : "info",
        icon: "gauge",
        text: `You are currently using ${formatPercent(status.utilization)} of your monthly budget.`,
      });
    }
  }

  // Average daily spend.
  if (avgDailySpend > 0) {
    out.push({
      id: "avg-daily",
      tone: "neutral",
      icon: "calendar",
      text: `Your average daily spending this month is ${formatINR(avgDailySpend)}.`,
    });
  }

  // Subscriptions.
  if (subscriptionSpend > 0) {
    out.push({
      id: "subscriptions",
      tone: "info",
      icon: "repeat",
      text: `Subscriptions cost you ${formatINR(subscriptionSpend)} this month.`,
    });
  }

  // Savings rate positivity.
  if (current.income > 0) {
    if (current.savingsRate >= 20) {
      out.push({
        id: "savings-good",
        tone: "positive",
        icon: "piggy-bank",
        text: `You saved ${formatPercent(current.savingsRate)} of your income this month. Nicely done.`,
      });
    } else if (current.savingsRate < 0) {
      out.push({
        id: "savings-negative",
        tone: "warning",
        icon: "alert-triangle",
        text: `You spent more than you earned this month by ${formatINR(-current.net)}.`,
      });
    }
  }

  return out;
}

/** Count trailing consecutive strictly-increasing steps in a series. */
export function trailingIncreaseStreak(series: number[]): number {
  if (series.length < 2) return 0;
  let streak = 0;
  for (let i = series.length - 1; i > 0; i--) {
    if (series[i] > series[i - 1]) streak += 1;
    else break;
  }
  // streak counts increasing steps; "3 consecutive months" == 2 rising steps.
  return streak === 0 ? 0 : streak + 1;
}
