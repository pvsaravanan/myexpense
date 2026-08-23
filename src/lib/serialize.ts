/** Convert Prisma rows into serialized DTOs (see types.ts). */
import type {
  Account,
  Category,
  FinancialGoal,
  GoalContribution,
  RecurringTransaction,
  Tag,
  Transaction,
  TransactionTag,
} from "@prisma/client";
import { toISODate } from "./dates";
import type {
  AccountDTO,
  CategoryDTO,
  GoalDTO,
  RecurringDTO,
  TagDTO,
  TransactionDTO,
} from "./types";
import type {
  AccountType,
  CategoryKind,
  Frequency,
  GoalStatus,
  PaymentMethod,
  TransactionType,
} from "./constants";

export function serializeAccount(a: Account, balance: number): AccountDTO {
  return {
    id: a.id,
    name: a.name,
    type: a.type as AccountType,
    openingBalance: a.openingBalance,
    color: a.color,
    icon: a.icon,
    isArchived: a.isArchived,
    sortOrder: a.sortOrder,
    balance,
  };
}

export function serializeCategory(c: Category): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    kind: c.kind as CategoryKind,
    monthlyBudget: c.monthlyBudget,
    parentId: c.parentId,
    isActive: c.isActive,
    isSystem: c.isSystem,
    sortOrder: c.sortOrder,
  };
}

export function serializeTag(t: Tag): TagDTO {
  return { id: t.id, name: t.name, color: t.color };
}

type TxnWithTags = Transaction & { tags?: (TransactionTag & { tag: Tag })[] };

export function serializeTransaction(t: TxnWithTags): TransactionDTO {
  return {
    id: t.id,
    type: t.type as TransactionType,
    amount: t.amount,
    description: t.description,
    merchant: t.merchant,
    date: toISODate(t.date),
    categoryId: t.categoryId,
    accountId: t.accountId,
    transferAccountId: t.transferAccountId,
    paymentMethod: (t.paymentMethod as PaymentMethod | null) ?? null,
    notes: t.notes,
    recurringId: t.recurringId,
    tags: t.tags?.map((tt) => tt.tag.name) ?? [],
  };
}

export function serializeRecurring(r: RecurringTransaction): RecurringDTO {
  return {
    id: r.id,
    name: r.name,
    type: r.type as "expense" | "income" | "transfer",
    amount: r.amount,
    categoryId: r.categoryId,
    accountId: r.accountId,
    transferAccountId: r.transferAccountId,
    paymentMethod: (r.paymentMethod as PaymentMethod | null) ?? null,
    notes: r.notes,
    frequency: r.frequency as Frequency,
    interval: r.interval,
    startDate: toISODate(r.startDate),
    endDate: r.endDate ? toISODate(r.endDate) : null,
    nextOccurrence: toISODate(r.nextOccurrence),
    lastPostedDate: r.lastPostedDate ? toISODate(r.lastPostedDate) : null,
    isActive: r.isActive,
    autoPost: r.autoPost,
  };
}

type GoalWithContributions = FinancialGoal & { contributions: GoalContribution[] };

export function serializeGoal(g: GoalWithContributions): GoalDTO {
  const currentAmount = g.contributions.reduce((sum, c) => sum + c.amount, 0);
  return {
    id: g.id,
    name: g.name,
    icon: g.icon,
    color: g.color,
    targetAmount: g.targetAmount,
    targetDate: g.targetDate ? toISODate(g.targetDate) : null,
    accountId: g.accountId,
    status: g.status as GoalStatus,
    currentAmount,
    contributions: g.contributions
      .slice()
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((c) => ({
        id: c.id,
        amount: c.amount,
        date: toISODate(c.date),
        note: c.note,
      })),
  };
}
