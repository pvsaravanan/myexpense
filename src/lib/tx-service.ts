import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { fromISODate } from "./dates";
import { NotFoundError } from "./api";
import type { TransactionInput } from "./validation";

/** Ensure the referenced account(s) and category belong to the user. */
async function assertOwnership(userId: string, input: TransactionInput | Omit<TransactionInput, "tags">) {
  const accountIds = [input.accountId, input.transferAccountId].filter(Boolean) as string[];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, userId },
    select: { id: true },
  });
  if (accounts.length !== new Set(accountIds).size) throw new NotFoundError("Account not found");

  if (input.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: input.categoryId, userId }, select: { id: true } });
    if (!cat) throw new NotFoundError("Category not found");
  }
}

/** Find-or-create tags by name for a user and return their ids. */
async function resolveTagIds(userId: string, names: string[]): Promise<string[]> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  // One insert for the missing tags, one read to fetch them all — instead of a
  // sequential upsert per tag, which was N round-trips against the hosted DB.
  await prisma.tag.createMany({
    data: unique.map((name) => ({ userId, name })),
    skipDuplicates: true,
  });
  const rows = await prisma.tag.findMany({
    where: { userId, name: { in: unique } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

function toData(userId: string, input: TransactionInput): Prisma.TransactionUncheckedCreateInput {
  const date = fromISODate(input.date);
  if (!date) throw new NotFoundError("Invalid date");
  return {
    userId,
    type: input.type,
    amount: input.amount,
    description: input.description,
    merchant: input.merchant ?? null,
    date,
    categoryId: input.type === "transfer" ? null : input.categoryId ?? null,
    accountId: input.accountId,
    transferAccountId: input.type === "transfer" ? input.transferAccountId ?? null : null,
    paymentMethod: input.paymentMethod ?? null,
    notes: input.notes ?? null,
  };
}

export async function createTransaction(userId: string, input: TransactionInput): Promise<string> {
  await assertOwnership(userId, input);
  const tagIds = await resolveTagIds(userId, input.tags ?? []);
  const created = await prisma.transaction.create({
    data: {
      ...toData(userId, input),
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
  });
  return created.id;
}

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true } });
  if (!existing) throw new NotFoundError("Transaction not found");
  await assertOwnership(userId, input);
  const tagIds = await resolveTagIds(userId, input.tags ?? []);
  // Return the fully-hydrated row from the update itself so the caller doesn't
  // need a follow-up findUnique (one fewer round-trip).
  const [, updated] = await prisma.$transaction([
    prisma.transactionTag.deleteMany({ where: { transactionId: id } }),
    prisma.transaction.update({
      where: { id },
      data: {
        ...toData(userId, input),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: { tags: { include: { tag: true } } },
    }),
  ]);
  return updated;
}

/** Soft-delete. Returns the id so the caller can offer undo. */
export async function softDeleteTransaction(userId: string, id: string): Promise<void> {
  const existing = await prisma.transaction.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new NotFoundError("Transaction not found");
  await prisma.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function restoreTransaction(userId: string, id: string): Promise<void> {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError("Transaction not found");
  await prisma.transaction.update({ where: { id }, data: { deletedAt: null } });
}

export async function duplicateTransaction(userId: string, id: string): Promise<string> {
  const original = await prisma.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    include: { tags: true },
  });
  if (!original) throw new NotFoundError("Transaction not found");
  const copy = await prisma.transaction.create({
    data: {
      userId,
      type: original.type,
      amount: original.amount,
      description: original.description,
      merchant: original.merchant,
      date: original.date,
      categoryId: original.categoryId,
      accountId: original.accountId,
      transferAccountId: original.transferAccountId,
      paymentMethod: original.paymentMethod,
      notes: original.notes,
      tags: { create: original.tags.map((t) => ({ tagId: t.tagId })) },
    },
  });
  return copy.id;
}
