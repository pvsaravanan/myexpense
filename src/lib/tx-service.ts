import "server-only";
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { fromISODate } from "./dates";
import { BadRequestError, NotFoundError } from "./api";
import type { ShareInput, SplitTransactionInput, TransactionInput } from "./validation";

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
  // Shares split a cost and are meaningless for a transfer (see the matching
  // schema refinement in validation.ts); drop them defensively so a transfer
  // can never carry shares regardless of how this function is called.
  const shares = input.type === "transfer" ? undefined : input.shares;
  // Validate shares before creating the row so an over-cap share fails fast
  // instead of leaving an orphaned transaction behind.
  if (shares?.length) await assertSharesValid(userId, shares, input.amount);
  const tagIds = await resolveTagIds(userId, input.tags ?? []);
  const created = await prisma.transaction.create({
    data: {
      ...toData(userId, input),
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
  });
  if (shares?.length) await attachShares(userId, created.id, shares);
  return created.id;
}

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true } });
  if (!existing) throw new NotFoundError("Transaction not found");
  await assertOwnership(userId, input);
  // A transfer can never carry shares (see createTransaction / validation.ts).
  // Forcing an empty array here also clears any shares left over should an
  // existing expense be edited into a transfer.
  const shares = input.type === "transfer" ? [] : input.shares;
  // Validate shares before mutating the row so invalid shares don't commit the
  // edit (and blow away the old tags) and only then throw.
  if (shares !== undefined) await assertSharesValid(userId, shares, input.amount);
  const tagIds = await resolveTagIds(userId, input.tags ?? []);
  await prisma.$transaction([
    prisma.transactionTag.deleteMany({ where: { transactionId: id } }),
    prisma.transaction.update({
      where: { id },
      data: {
        ...toData(userId, input),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    }),
  ]);
  // `shares` omitted entirely means "leave as-is"; an explicit (possibly
  // empty) array means "replace with this".
  if (shares !== undefined) await attachShares(userId, id, shares);
  // Re-fetch once, fully hydrated, so the returned row reflects the shares
  // change above rather than the pre-attachShares snapshot.
  return prisma.transaction.findUniqueOrThrow({
    where: { id },
    include: { tags: { include: { tag: true } }, shares: { include: { contact: true } } },
  });
}

/**
 * Replace the set of people this transaction is shared with. The sum of
 * shares can never exceed `capAmount` (defaults to the transaction's own
 * amount) — for a split expense, callers pass the group's total instead so a
 * friend's share can span the whole purchase, not just one category/account
 * part of it.
 */
/**
 * Validate a set of shares BEFORE any rows are written: the sum must not
 * exceed `cap`, and every contact must belong to the user. Callers run this
 * up front so an invalid share can't commit a transaction/parts and only then
 * throw, leaving orphaned rows behind.
 */
export async function assertSharesValid(userId: string, shares: ShareInput[], cap: number): Promise<void> {
  if (!shares.length) return;
  const sum = shares.reduce((s, x) => s + x.amount, 0);
  if (sum > cap) throw new BadRequestError("Shared amounts can't exceed the total");
  const contactIds = [...new Set(shares.map((s) => s.contactId))];
  const contacts = await prisma.contact.findMany({ where: { id: { in: contactIds }, userId }, select: { id: true } });
  if (contacts.length !== contactIds.length) throw new NotFoundError("Contact not found");
}

export async function attachShares(
  userId: string,
  transactionId: string,
  shares: ShareInput[],
  capAmount?: number,
): Promise<void> {
  const txn = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, deletedAt: null },
    select: { id: true, amount: true },
  });
  if (!txn) throw new NotFoundError("Transaction not found");

  await assertSharesValid(userId, shares, capAmount ?? txn.amount);

  await prisma.$transaction([
    prisma.expenseShare.deleteMany({ where: { transactionId } }),
    ...(shares.length
      ? [
          prisma.expenseShare.createMany({
            data: shares.map((s) => ({ transactionId, contactId: s.contactId, amount: s.amount })),
          }),
        ]
      : []),
  ]);
}

function toSplitPartData(
  userId: string,
  input: SplitTransactionInput,
  part: SplitTransactionInput["parts"][number],
  date: Date,
  splitGroupId: string,
): Prisma.TransactionUncheckedCreateInput {
  return {
    userId,
    type: "expense",
    amount: part.amount,
    description: part.description?.trim() || input.description,
    merchant: input.merchant ?? null,
    date,
    categoryId: part.categoryId ?? null,
    accountId: part.accountId,
    paymentMethod: input.paymentMethod ?? null,
    notes: input.notes ?? null,
    splitGroupId,
  };
}

/**
 * One logical expense split across categories and/or accounts: each part
 * becomes its own real Transaction row (so balances, budgets and category
 * totals need no special-casing), all sharing `splitGroupId` so the UI can
 * bundle them for display and editing.
 */
export async function createSplitTransaction(
  userId: string,
  input: SplitTransactionInput,
  opts: { splitGroupId?: string; replaceId?: string } = {},
): Promise<string[]> {
  const splitGroupId = opts.splitGroupId ?? randomUUID();
  const date = fromISODate(input.date);
  if (!date) throw new NotFoundError("Invalid date");

  const accountIds = [...new Set(input.parts.map((p) => p.accountId))];
  const categoryIds = [...new Set(input.parts.map((p) => p.categoryId).filter(Boolean))] as string[];
  const [accounts, cats] = await Promise.all([
    prisma.account.findMany({ where: { id: { in: accountIds }, userId }, select: { id: true } }),
    categoryIds.length
      ? prisma.category.findMany({ where: { id: { in: categoryIds }, userId }, select: { id: true } })
      : Promise.resolve([]),
  ]);
  if (accounts.length !== accountIds.length) throw new NotFoundError("Account not found");
  if (cats.length !== categoryIds.length) throw new NotFoundError("Category not found");

  // Validate shares against the group total up front, so an over-cap share
  // fails before any part rows are written (avoiding orphaned parts).
  const partsTotal = input.parts.reduce((s, p) => s + p.amount, 0);
  if (input.shares?.length) await assertSharesValid(userId, input.shares, partsTotal);

  // Converting a saved single transaction into a split: verify ownership up
  // front, then hard-delete it in the same batch as the new parts land so the
  // conversion is atomic (its tags/shares cascade away with it).
  if (opts.replaceId) {
    const original = await prisma.transaction.findFirst({
      where: { id: opts.replaceId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!original) throw new NotFoundError("Transaction not found");
  }

  const tagIds = await resolveTagIds(userId, input.tags ?? []);
  const creates = input.parts.map((part) =>
    prisma.transaction.create({
      data: {
        ...toSplitPartData(userId, input, part, date, splitGroupId),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    }),
  );
  // Prepend the delete (when converting) so it commits atomically with the
  // new parts. Every op returns a Transaction, so the array is uniformly typed.
  const ops = opts.replaceId
    ? [prisma.transaction.delete({ where: { id: opts.replaceId } }), ...creates]
    : creates;
  const results = await prisma.$transaction(ops);
  const rows = opts.replaceId ? results.slice(1) : results;

  if (input.shares?.length) {
    await attachShares(userId, rows[0].id, input.shares, partsTotal);
  }

  return rows.map((r) => r.id);
}

/** Replace every part of an existing split group with a fresh set. */
export async function updateSplitTransaction(
  userId: string,
  splitGroupId: string,
  input: SplitTransactionInput,
): Promise<string[]> {
  const existing = await prisma.transaction.findMany({
    where: { userId, splitGroupId, deletedAt: null },
    select: { id: true },
  });
  if (existing.length === 0) throw new NotFoundError("Split transaction not found");

  // Editing this compound unit is a full replace, not a per-row edit — hard
  // delete the old rows (cascades tags/shares) and recreate under the same
  // group id, rather than trying to diff and patch a variable-length list.
  await prisma.transaction.deleteMany({ where: { userId, splitGroupId } });
  return createSplitTransaction(userId, input, { splitGroupId });
}

/** Soft-delete every part of a split group together. */
export async function softDeleteSplitGroup(userId: string, splitGroupId: string): Promise<void> {
  const existing = await prisma.transaction.findMany({
    where: { userId, splitGroupId, deletedAt: null },
    select: { id: true },
  });
  if (existing.length === 0) throw new NotFoundError("Split transaction not found");
  await prisma.transaction.updateMany({ where: { userId, splitGroupId }, data: { deletedAt: new Date() } });
}

/** Soft-delete. Returns the id so the caller can offer undo. */
export async function softDeleteTransaction(userId: string, id: string): Promise<void> {
  const existing = await prisma.transaction.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new NotFoundError("Transaction not found");
  await prisma.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
}

/**
 * Soft-delete a batch of transactions in one go (multi-select "delete" in
 * the transactions list). Any selected row that belongs to a split group
 * takes its whole group down too, so a split expense is never left
 * half-deleted just because only one of its parts was checked.
 */
export async function bulkSoftDeleteTransactions(userId: string, ids: string[]): Promise<number> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return 0;

  const rows = await prisma.transaction.findMany({
    where: { id: { in: unique }, userId, deletedAt: null },
    select: { id: true, splitGroupId: true },
  });
  if (rows.length === 0) return 0;

  const splitGroupIds = [...new Set(rows.map((r) => r.splitGroupId).filter(Boolean) as string[])];
  const plainIds = rows.filter((r) => !r.splitGroupId).map((r) => r.id);

  const result = await prisma.transaction.updateMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        ...(plainIds.length ? [{ id: { in: plainIds } }] : []),
        ...(splitGroupIds.length ? [{ splitGroupId: { in: splitGroupIds } }] : []),
      ],
    },
    data: { deletedAt: new Date() },
  });
  return result.count;
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
