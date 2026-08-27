import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";
import { buildCSV } from "@/lib/csv";
import { toISODate } from "@/lib/dates";
import { buildWhere } from "@/lib/query";
import { PAYMENT_METHOD_LABELS, TYPE_LABELS, type PaymentMethod, type TransactionType } from "@/lib/constants";

export const GET = withUser(async (user, req: NextRequest) => {
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const stamp = toISODate(new Date());

  if (format === "csv") {
    // Apply the same filter params the transactions list accepts (date range,
    // type, account, category, tag, text search, amount range).
    const where = buildWhere(user.id, req.nextUrl.searchParams);

    // The running balance shown per row must reflect each account's real
    // balance history, not one recomputed from just the filtered/exported
    // rows — so walk *every* undeleted transaction in chronological order
    // first, and only afterwards pick out the balance-after for the rows
    // that pass the filter.
    const [txns, allTxns, categories, accounts] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { tags: { include: { tag: true } } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.transaction.findMany({
        where: { userId: user.id, deletedAt: null },
        select: { id: true, type: true, amount: true, accountId: true, transferAccountId: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.category.findMany({ where: { userId: user.id } }),
      prisma.account.findMany({ where: { userId: user.id } }),
    ]);
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const acctName = new Map(accounts.map((a) => [a.id, a.name]));

    const runningBalance = new Map(accounts.map((a) => [a.id, a.openingBalance]));
    const balanceAfter = new Map<string, number>();
    for (const t of allTxns) {
      if (t.type === "income" || t.type === "refund") {
        runningBalance.set(t.accountId, (runningBalance.get(t.accountId) ?? 0) + t.amount);
      } else if (t.type === "expense" || t.type === "transfer") {
        runningBalance.set(t.accountId, (runningBalance.get(t.accountId) ?? 0) - t.amount);
      }
      if (t.type === "transfer" && t.transferAccountId) {
        runningBalance.set(t.transferAccountId, (runningBalance.get(t.transferAccountId) ?? 0) + t.amount);
      }
      // The row's own "Balance" column follows its primary account
      // (`accountId`) — the side the "Account" column already names.
      balanceAfter.set(t.id, runningBalance.get(t.accountId) ?? 0);
    }

    const headers = [
      "Sr.No",
      "Date",
      "Type",
      "Description",
      "Debit (₹)",
      "Credit (₹)",
      "Category",
      "Account",
      "To Account",
      "Payment Method",
      "Tags",
      "Notes",
      "Balance (₹)",
    ];
    const isDebit = (type: string) => type === "expense" || type === "transfer";
    const rows = txns.map((t, i) => [
      String(i + 1),
      toISODate(t.date),
      TYPE_LABELS[t.type as TransactionType] ?? t.type,
      t.description,
      isDebit(t.type) ? (t.amount / 100).toFixed(2) : "",
      !isDebit(t.type) ? (t.amount / 100).toFixed(2) : "",
      t.categoryId ? catName.get(t.categoryId) ?? "" : "",
      acctName.get(t.accountId) ?? "",
      t.transferAccountId ? acctName.get(t.transferAccountId) ?? "" : "",
      t.paymentMethod ? PAYMENT_METHOD_LABELS[t.paymentMethod as PaymentMethod] ?? t.paymentMethod : "",
      t.tags.map((tt) => tt.tag.name).join("; "),
      t.notes ?? "",
      ((balanceAfter.get(t.id) ?? 0) / 100).toFixed(2),
    ]);
    const csv = buildCSV(headers, rows);
    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="baaki-transactions-${stamp}.csv"`,
      },
    });
  }

  // Full JSON backup.
  const [transactions, categories, accounts, budgets, goals, recurring, tags] = await Promise.all([
    prisma.transaction.findMany({ where: { userId: user.id, deletedAt: null }, include: { tags: { include: { tag: true } } } }),
    prisma.category.findMany({ where: { userId: user.id } }),
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.budget.findMany({ where: { userId: user.id }, include: { categories: true } }),
    prisma.financialGoal.findMany({ where: { userId: user.id }, include: { contributions: true } }),
    prisma.recurringTransaction.findMany({ where: { userId: user.id } }),
    prisma.tag.findMany({ where: { userId: user.id } }),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    app: "baaki",
    version: 1,
    note: "All monetary values are in integer paise (1 rupee = 100 paise).",
    transactions: transactions.map((t) => ({
      ...t,
      date: toISODate(t.date),
      tags: t.tags.map((tt) => tt.tag.name),
    })),
    categories,
    accounts,
    budgets,
    goals: goals.map((g) => ({ ...g, targetDate: g.targetDate ? toISODate(g.targetDate) : null })),
    recurring: recurring.map((r) => ({
      ...r,
      startDate: toISODate(r.startDate),
      endDate: r.endDate ? toISODate(r.endDate) : null,
      nextOccurrence: toISODate(r.nextOccurrence),
    })),
    tags,
  };

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="baaki-backup-${stamp}.json"`,
    },
  });
});
