import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { accountBalance, type CalcTxn } from "./calculations";
import {
  serializeAccount,
  serializeCategory,
  serializeGoal,
  serializeRecurring,
  serializeTag,
  serializeTransaction,
} from "./serialize";
import type {
  AccountDTO,
  BudgetDTO,
  CategoryDTO,
  GoalDTO,
  PreferenceDTO,
  RecurringDTO,
  TagDTO,
  TransactionDTO,
} from "./types";
import { DEFAULT_DASHBOARD_WIDGETS } from "./constants";

/**
 * Per-request cached raw loaders. Both the layout loaders AND
 * getMonthlyAnalytics need the accounts/categories/transactions tables; caching
 * them means a single render fetches each once instead of once per caller.
 */
export const getUserAccounts = cache((userId: string) =>
  prisma.account.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
);
export const getUserCategories = cache((userId: string) =>
  prisma.category.findMany({ where: { userId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
);

/** Every non-deleted transaction for a user, as calc-ready rows. */
export const loadCalcTxns = cache(async (userId: string): Promise<CalcTxn[]> => {
  const rows = await prisma.transaction.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      type: true,
      amount: true,
      description: true,
      date: true,
      categoryId: true,
      accountId: true,
      transferAccountId: true,
      deletedAt: true,
    },
  });
  return rows.map((r) => ({ ...r, type: r.type as CalcTxn["type"] }));
});

export async function loadAccounts(userId: string): Promise<AccountDTO[]> {
  const [accounts, txns] = await Promise.all([getUserAccounts(userId), loadCalcTxns(userId)]);
  return accounts.map((a) => serializeAccount(a, accountBalance({ id: a.id, openingBalance: a.openingBalance }, txns)));
}

export async function loadCategories(userId: string): Promise<CategoryDTO[]> {
  const rows = await getUserCategories(userId);
  return rows.map(serializeCategory);
}

export async function loadTags(userId: string): Promise<TagDTO[]> {
  const rows = await prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" } });
  return rows.map(serializeTag);
}

export async function loadTransactions(
  userId: string,
  opts: { take?: number; skip?: number } = {},
): Promise<TransactionDTO[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, deletedAt: null },
    include: { tags: { include: { tag: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: opts.take,
    skip: opts.skip,
  });
  return rows.map(serializeTransaction);
}

export async function countTransactions(userId: string): Promise<number> {
  return prisma.transaction.count({
    where: { userId, deletedAt: null },
  });
}


export const loadPreference = cache(async (userId: string): Promise<PreferenceDTO> => {
  // Reuse the cached accounts (already fetched by loadAccounts in the layout)
  // and resolve firstAccount / default-account validity in memory, instead of
  // firing two or three separate `account` queries here.
  const [pref, accounts] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId } }),
    getUserAccounts(userId),
  ]);
  const activeAccounts = accounts.filter((a) => !a.isArchived); // already ordered by sortOrder
  const firstAccount = activeAccounts[0] ?? null;

  let widgets: string[] = [...DEFAULT_DASHBOARD_WIDGETS];
  if (pref?.dashboardWidgets) {
    try {
      const parsed = JSON.parse(pref.dashboardWidgets);
      if (Array.isArray(parsed) && parsed.length) widgets = parsed;
    } catch {
      /* fall back to defaults */
    }
  }

  let defaultAccountId = pref?.defaultAccountId ?? null;
  if (!defaultAccountId || !activeAccounts.some((a) => a.id === defaultAccountId)) {
    defaultAccountId = firstAccount?.id ?? null;
  }

  return {
    theme: (pref?.theme as PreferenceDTO["theme"]) ?? "system",
    dashboardWidgets: widgets,
    defaultAccountId,
  };
});

export async function loadRecurring(userId: string): Promise<RecurringDTO[]> {
  const rows = await prisma.recurringTransaction.findMany({
    where: { userId },
    orderBy: [{ isActive: "desc" }, { nextOccurrence: "asc" }],
  });
  return rows.map(serializeRecurring);
}

export async function loadGoals(userId: string): Promise<GoalDTO[]> {
  const rows = await prisma.financialGoal.findMany({
    where: { userId },
    include: { contributions: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(serializeGoal);
}

/**
 * Budget for a month. If no explicit Budget row exists, fall back to each
 * category's default monthlyBudget so the budgets screen is never empty.
 */
export async function loadBudget(userId: string, year: number, month: number): Promise<BudgetDTO> {
  const budget = await prisma.budget.findUnique({
    where: { userId_year_month: { userId, year, month } },
    include: { categories: true },
  });

  if (budget) {
    return {
      id: budget.id,
      year,
      month,
      overallLimit: budget.overallLimit,
      categories: budget.categories.map((c) => ({ categoryId: c.categoryId, limit: c.limit })),
    };
  }

  // Fallback: build a virtual budget from category defaults.
  const cats = await prisma.category.findMany({
    where: { userId, monthlyBudget: { not: null }, isActive: true },
    select: { id: true, monthlyBudget: true },
  });
  return {
    id: null,
    year,
    month,
    overallLimit: null,
    categories: cats.map((c) => ({ categoryId: c.id, limit: c.monthlyBudget! })),
  };
}
