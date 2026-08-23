/**
 * Pure financial calculation layer.
 *
 * Every function here is deterministic and free of I/O so it can be unit-tested
 * in isolation (see calculations.test.ts). All amounts are integer paise.
 *
 * Rules (from the product spec):
 *  - Balance = opening + income + refunds − expenses − transfers-out + transfers-in
 *  - Transfers between the user's own accounts are NOT income or expense.
 *  - Refunds reduce the effective expense amount.
 *  - Savings = income − effective expenses;  effective expense = expenses − refunds
 *  - Savings rate = (income − effective expenses) / income × 100  (0 when income = 0)
 *  - Category spending counts actual expenses (net of refunds in that category).
 */

import type { TransactionType } from "./constants";
import { daysBetween, startOfDay, toISODate } from "./dates";

/** Minimal transaction shape the calc layer needs. Framework-agnostic. */
export interface CalcTxn {
  id?: string;
  type: TransactionType;
  amount: number; // paise, always positive
  description?: string;
  date: Date;
  categoryId?: string | null;
  accountId: string;
  transferAccountId?: string | null;
  deletedAt?: Date | null;
}

export interface CalcAccount {
  id: string;
  openingBalance: number; // paise
}

export function isActive(t: CalcTxn): boolean {
  return t.deletedAt == null;
}

export function activeOnly<T extends CalcTxn>(txns: T[]): T[] {
  return txns.filter(isActive);
}

function inRange(date: Date, start?: Date, end?: Date): boolean {
  if (start && date.getTime() < start.getTime()) return false;
  if (end && date.getTime() >= end.getTime()) return false;
  return true;
}

/** Filter to active transactions within [start, end) (bounds optional). */
export function filterRange<T extends CalcTxn>(txns: T[], start?: Date, end?: Date): T[] {
  return txns.filter((t) => isActive(t) && inRange(t.date, start, end));
}

/**
 * Balance of a single account: opening balance plus the net effect of every
 * active transaction that touches it (as source or transfer destination).
 */
export function accountBalance(account: CalcAccount, txns: CalcTxn[]): number {
  let balance = account.openingBalance;
  for (const t of txns) {
    if (!isActive(t)) continue;
    if (t.accountId === account.id) {
      switch (t.type) {
        case "income":
        case "refund":
          balance += t.amount;
          break;
        case "expense":
          balance -= t.amount;
          break;
        case "transfer":
          balance -= t.amount; // money leaving the source account
          break;
      }
    }
    if (t.type === "transfer" && t.transferAccountId === account.id) {
      balance += t.amount; // money arriving in the destination account
    }
  }
  return balance;
}

/** Total balance across all accounts (transfers net to zero). */
export function totalBalance(accounts: CalcAccount[], txns: CalcTxn[]): number {
  return accounts.reduce((sum, a) => sum + accountBalance(a, txns), 0);
}

export interface PeriodSummary {
  income: number; // gross income
  grossExpense: number;
  refunds: number;
  effectiveExpense: number; // grossExpense − refunds
  transfersOut: number;
  transfersIn: number;
  net: number; // income − effectiveExpense (a.k.a. net savings / net cash flow)
  savingsRate: number; // percent, 0 when income = 0
  count: number; // active transactions in the period
}

/** Summarize a set of already-range-filtered transactions. */
export function summarize(txns: CalcTxn[]): PeriodSummary {
  let income = 0;
  let grossExpense = 0;
  let refunds = 0;
  let transfersOut = 0;
  let transfersIn = 0;
  let count = 0;

  for (const t of txns) {
    if (!isActive(t)) continue;
    count += 1;
    switch (t.type) {
      case "income":
        income += t.amount;
        break;
      case "expense":
        grossExpense += t.amount;
        break;
      case "refund":
        refunds += t.amount;
        break;
      case "transfer":
        transfersOut += t.amount;
        transfersIn += t.amount;
        break;
    }
  }

  const effectiveExpense = grossExpense - refunds;
  const net = income - effectiveExpense;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  return {
    income,
    grossExpense,
    refunds,
    effectiveExpense,
    transfersOut,
    transfersIn,
    net,
    savingsRate,
    count,
  };
}

export interface CategoryTotal {
  categoryId: string | null;
  expense: number; // gross expense in category
  refund: number; // refunds in category
  net: number; // expense − refund (effective spend)
  count: number;
}

/**
 * Spending grouped by category. Only expense/refund transactions contribute.
 * `net` is the effective spend used by budgets; `expense` is the gross figure
 * used by the "expenses by category" chart.
 */
export function categoryTotals(txns: CalcTxn[]): CategoryTotal[] {
  const map = new Map<string | null, CategoryTotal>();
  for (const t of txns) {
    if (!isActive(t)) continue;
    if (t.type !== "expense" && t.type !== "refund") continue;
    const key = t.categoryId ?? null;
    let entry = map.get(key);
    if (!entry) {
      entry = { categoryId: key, expense: 0, refund: 0, net: 0, count: 0 };
      map.set(key, entry);
    }
    if (t.type === "expense") entry.expense += t.amount;
    else entry.refund += t.amount;
    entry.net = entry.expense - entry.refund;
    entry.count += 1;
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

/** Effective spend for a single category (expenses − refunds). */
export function categorySpend(txns: CalcTxn[], categoryId: string): number {
  let spend = 0;
  for (const t of txns) {
    if (!isActive(t) || t.categoryId !== categoryId) continue;
    if (t.type === "expense") spend += t.amount;
    else if (t.type === "refund") spend -= t.amount;
  }
  return spend;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  expense: number; // effective expense that day (>= 0 floor for intensity)
  income: number;
  count: number;
}

/** Per-day totals across [start, end). Fills gaps so every day is present. */
export function dailySeries(txns: CalcTxn[], start: Date, end: Date): DailyPoint[] {
  const byDay = new Map<string, DailyPoint>();
  const cursor = startOfDay(start);
  while (cursor.getTime() < end.getTime()) {
    const key = toISODate(cursor);
    byDay.set(key, { date: key, expense: 0, income: 0, count: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const t of txns) {
    if (!isActive(t)) continue;
    const key = toISODate(t.date);
    const point = byDay.get(key);
    if (!point) continue;
    point.count += 1;
    if (t.type === "expense") point.expense += t.amount;
    else if (t.type === "refund") point.expense -= t.amount;
    else if (t.type === "income") point.income += t.amount;
  }
  for (const p of byDay.values()) if (p.expense < 0) p.expense = Math.max(p.expense, 0);
  return [...byDay.values()];
}

/**
 * Percentage change from previous to current.
 * Returns null when it cannot be expressed as a percentage (previous is 0 and
 * current is non-zero) so the UI can show "New" instead of Infinity.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type BudgetState = "under" | "warning" | "over";

export interface BudgetStatus {
  limit: number;
  spent: number;
  remaining: number; // can be negative when over budget
  utilization: number; // percent (spent / limit * 100)
  state: BudgetState;
}

/** Budget status for a category or the overall budget. Warning at >= 90%. */
export function budgetStatus(spent: number, limit: number, warnAt = 90): BudgetStatus {
  const remaining = limit - spent;
  const utilization = limit > 0 ? (spent / limit) * 100 : spent > 0 ? Infinity : 0;
  let state: BudgetState = "under";
  // Exactly at the limit (100% utilization) is "over" too — labelling it
  // "warning" implied there was still headroom. The `limit > 0 || spent > 0`
  // guard keeps a 0/0 budget as "under" rather than flipping it to "over".
  if (spent >= limit && (limit > 0 || spent > 0)) state = "over";
  else if (utilization >= warnAt) state = "warning";
  return { limit, spent, remaining, utilization, state };
}

/**
 * Monthly contribution needed to reach a savings goal by its target date.
 * Returns the paise/month required; 0 if already reached or no valid date.
 */
export function monthlyContributionNeeded(
  target: number,
  current: number,
  today: Date,
  targetDate: Date | null,
): number {
  const remaining = target - current;
  if (remaining <= 0) return 0;
  if (!targetDate) return remaining;
  const months = monthsBetween(today, targetDate);
  if (months <= 0) return remaining;
  return Math.ceil(remaining / months);
}

/** Whole months from `from` to `to`, minimum 0. Partial months round up to 1. */
export function monthsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() > from.getDate()) months += 1;
  return Math.max(months, 1);
}

/** Average daily spend across a period given its effective expense total. */
export function averageDailySpend(effectiveExpense: number, start: Date, end: Date): number {
  const days = Math.max(daysBetween(start, end), 1);
  return Math.round(effectiveExpense / days);
}
