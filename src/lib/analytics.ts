import "server-only";
import { getUserAccounts, getUserCategories, loadBudget, loadCalcTxns } from "./queries";
import {
  accountBalance,
  averageDailySpend,
  budgetStatus,
  categoryTotals,
  dailySeries,
  filterRange,
  percentChange,
  summarize,
  type BudgetStatus,
  type CalcTxn,
  type PeriodSummary,
} from "./calculations";
import { addMonths, monthName, monthRange, type MonthKey } from "./dates";
import { generateInsights, type Insight } from "./insights";
import type { CategoryDTO } from "./types";
import { serializeCategory } from "./serialize";

export interface CategorySpendRow {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  expense: number;
  refund: number;
  net: number;
  count: number;
}

export interface BudgetLine {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  limit: number;
  spent: number;
  status: BudgetStatus;
}

export interface MonthlyAnalytics {
  monthKey: MonthKey;
  current: PeriodSummary;
  previous: PeriodSummary;
  deltas: {
    income: number | null;
    expense: number | null;
    net: number | null;
    savings: number | null;
  };
  categories: CategorySpendRow[];
  daily: { date: string; expense: number; income: number; count: number }[];
  largestExpense: { description: string; amount: number; date: Date; categoryName: string | null } | null;
  topCategory: { name: string; net: number } | null;
  transactionCount: number;
  totalBalance: number;
  avgDailySpend: number;
  subscriptionSpend: number;
  budget: {
    overallLimit: number | null;
    overallSpent: number;
    status: BudgetStatus | null;
    lines: BudgetLine[];
  };
  incomeExpenseTrend: { label: string; month: number; year: number; income: number; expense: number }[];
  insights: Insight[];
}

function toRows(txns: CalcTxn[], categories: Map<string, CategoryDTO>): CategorySpendRow[] {
  return categoryTotals(txns).map((c) => {
    const meta = c.categoryId ? categories.get(c.categoryId) : null;
    return {
      categoryId: c.categoryId,
      name: meta?.name ?? "Uncategorized",
      color: meta?.color ?? "#94a3b8",
      icon: meta?.icon ?? "circle-dot",
      expense: c.expense,
      refund: c.refund,
      net: c.net,
      count: c.count,
    };
  });
}

/** Everything the dashboard, insights and monthly views need for a month. */
export async function getMonthlyAnalytics(
  userId: string,
  monthKey: MonthKey,
  preloadedTxns?: CalcTxn[],
): Promise<MonthlyAnalytics> {
  const [txns, accountsRaw, categoriesRaw, budget] = await Promise.all([
    preloadedTxns ? Promise.resolve(preloadedTxns) : loadCalcTxns(userId),
    getUserAccounts(userId),
    getUserCategories(userId),
    loadBudget(userId, monthKey.year, monthKey.month),
  ]);

  const categories = new Map(categoriesRaw.map((c) => [c.id, serializeCategory(c)]));
  const subscriptionCategoryId =
    categoriesRaw.find((c) => c.name.trim().toLowerCase() === "subscriptions")?.id ?? null;

  const range = monthRange(monthKey);
  const prevRange = monthRange(addMonths(monthKey, -1));

  const monthTxns = filterRange(txns, range.start, range.end);
  const prevTxns = filterRange(txns, prevRange.start, prevRange.end);

  const current = summarize(monthTxns);
  const previous = summarize(prevTxns);

  const categoryRows = toRows(monthTxns, categories).filter((c) => c.expense > 0 || c.refund > 0);
  const prevCategoryTotals = categoryTotals(prevTxns);

  // Largest single expense this month computed in-memory (0 extra DB queries).
  let largestExpense: MonthlyAnalytics["largestExpense"] = null;
  const monthExpenses = monthTxns.filter((t) => t.type === "expense");
  if (monthExpenses.length > 0) {
    const largest = monthExpenses.reduce((max, t) => (t.amount > max.amount ? t : max), monthExpenses[0]);
    largestExpense = {
      description: largest.description ?? "Expense",
      amount: largest.amount,
      date: largest.date,
      categoryName: largest.categoryId ? categories.get(largest.categoryId)?.name ?? null : null,
    };
  }

  const topCategory = categoryRows[0] ? { name: categoryRows[0].name, net: categoryRows[0].net } : null;

  // Budget lines.
  const spentByCategory = new Map(categoryTotals(monthTxns).map((c) => [c.categoryId, c.net]));
  const lines: BudgetLine[] = budget.categories.map((bc) => {
    const meta = categories.get(bc.categoryId);
    const spent = spentByCategory.get(bc.categoryId) ?? 0;
    return {
      categoryId: bc.categoryId,
      name: meta?.name ?? "Category",
      color: meta?.color ?? "#94a3b8",
      icon: meta?.icon ?? "circle-dot",
      limit: bc.limit,
      spent,
      status: budgetStatus(spent, bc.limit),
    };
  });
  const overallSpent = current.effectiveExpense;
  const overallStatus = budget.overallLimit ? budgetStatus(overallSpent, budget.overallLimit) : null;

  // Income vs expense trend, up to 12 months (the client chart lets the user
  // pick a 1 / 3 / 6 / 12-month window by slicing this).
  const incomeExpenseTrend: MonthlyAnalytics["incomeExpenseTrend"] = [];
  for (let i = 11; i >= 0; i--) {
    const key = addMonths(monthKey, -i);
    const r = monthRange(key);
    const s = summarize(filterRange(txns, r.start, r.end));
    incomeExpenseTrend.push({ label: monthName(key.month, true), month: key.month, year: key.year, income: s.income, expense: s.effectiveExpense });
  }
  // Rising-spend streak insight uses the trailing 6 months of the same trend.
  const monthlyExpenseTrend = incomeExpenseTrend.slice(-6).map((m) => m.expense);

  const subscriptionSpend = subscriptionCategoryId ? spentByCategory.get(subscriptionCategoryId) ?? 0 : 0;
  const avgDaily = averageDailySpend(current.effectiveExpense, range.start, cappedEnd(range.start, range.end));

  const insights = generateInsights({
    current,
    previous,
    currentCategories: categoryTotals(monthTxns),
    previousCategories: prevCategoryTotals,
    categoryNames: new Map([...categories.entries()].map(([id, c]) => [id, c.name])),
    monthlyExpenseTrend,
    overallBudgetLimit: budget.overallLimit,
    avgDailySpend: avgDaily,
    subscriptionSpend,
  });

  return {
    monthKey,
    current,
    previous,
    deltas: {
      income: percentChange(current.income, previous.income),
      expense: percentChange(current.effectiveExpense, previous.effectiveExpense),
      net: percentChange(current.net, previous.net),
      // savingsRate is already a percentage, so a percent-change of it is
      // meaningless (and a legitimate 0% last month reads as "New"). Report the
      // month-over-month change in percentage points instead.
      savings:
        previous.income > 0 || current.income > 0
          ? current.savingsRate - previous.savingsRate
          : null,
    },
    categories: categoryRows,
    daily: dailySeries(monthTxns, range.start, range.end),
    largestExpense,
    topCategory,
    transactionCount: current.count,
    // Exclude archived accounts so the dashboard total matches the Accounts and
    // Reports pages, which both filter out archived accounts.
    totalBalance: accountsRaw
      .filter((a) => !a.isArchived)
      .reduce((sum, a) => sum + accountBalance({ id: a.id, openingBalance: a.openingBalance }, txns), 0),
    avgDailySpend: avgDaily,
    subscriptionSpend,
    budget: { overallLimit: budget.overallLimit, overallSpent, status: overallStatus, lines },
    incomeExpenseTrend,
    insights,
  };
}

/**
 * The end date to use for the daily-average day count:
 *  - current month (now within [start, end)): count days through today;
 *  - past month (now >= end): the full month;
 *  - future month (now < start): the full month too. Without the `now < start`
 *    guard this returned "tomorrow", which is BEFORE a future month's start,
 *    giving a negative day count that clamped to 1 and reported the whole
 *    month's expense as the daily average.
 */
function cappedEnd(start: Date, end: Date): Date {
  const now = new Date();
  if (now < start || now >= end) return end;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}
