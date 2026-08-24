import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { NotFoundError } from "./api";
import { serializeContact } from "./serialize";
import { toISODate } from "./dates";
import type { ContactDTO, ShareDirection } from "./types";

export interface ContactShareRow {
  id: string;
  amount: number; // paise
  direction: ShareDirection;
  settled: boolean;
  settledAt: string | null;
  transactionId: string | null;
  description: string;
  date: string;
}

// A share counts toward a live balance only if it's either standalone
// (no transaction) or its transaction still exists (not soft-deleted).
const LIVE_SHARE: Prisma.ExpenseShareWhereInput = {
  OR: [{ transactionId: null }, { transaction: { deletedAt: null } }],
};

/** Every ledger line (both directions, settled and pending) with one contact, newest first. */
export async function loadContactShares(userId: string, contactId: string): Promise<ContactShareRow[]> {
  const rows = await prisma.expenseShare.findMany({
    where: { contactId, contact: { userId }, ...LIVE_SHARE },
    include: { transaction: { select: { id: true, description: true, date: true } } },
    orderBy: [{ settled: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    amount: s.amount,
    direction: s.direction as ShareDirection,
    settled: s.settled,
    settledAt: s.settledAt ? toISODate(s.settledAt) : null,
    transactionId: s.transaction?.id ?? null,
    description: s.transaction?.description ?? s.description ?? "Manual entry",
    date: s.transaction ? toISODate(s.transaction.date) : toISODate(s.date),
  }));
}

/** Contacts with their current net balance (unsettled shares, both directions). */
export async function loadContacts(userId: string): Promise<ContactDTO[]> {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: [{ isArchived: "asc" }, { name: "asc" }],
    include: {
      shares: {
        where: { settled: false, ...LIVE_SHARE },
        select: { amount: true, direction: true },
      },
    },
  });
  return contacts.map((c) => {
    let owedToYou = 0;
    let youOwe = 0;
    for (const s of c.shares) {
      if (s.direction === "you_owe") youOwe += s.amount;
      else owedToYou += s.amount;
    }
    return serializeContact(c, owedToYou, youOwe);
  });
}

export async function createContact(userId: string, input: { name: string; color?: string }) {
  return prisma.contact.create({
    data: { userId, name: input.name.trim(), color: input.color ?? "#64748b" },
  });
}

export async function updateContact(
  userId: string,
  id: string,
  input: Partial<{ name: string; color: string; isArchived: boolean }>,
): Promise<void> {
  const existing = await prisma.contact.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError("Contact not found");
  await prisma.contact.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
    },
  });
}

/** Hard-delete if the contact has no share history, otherwise archive so past splits keep a name. */
export async function deleteContact(userId: string, id: string): Promise<void> {
  const existing = await prisma.contact.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError("Contact not found");
  const shareCount = await prisma.expenseShare.count({ where: { contactId: id } });
  if (shareCount > 0) {
    await prisma.contact.update({ where: { id }, data: { isArchived: true } });
  } else {
    await prisma.contact.delete({ where: { id } });
  }
}

/** Record a standalone ledger entry against a contact (either direction). */
export async function createStandaloneShare(
  userId: string,
  contactId: string,
  input: { amount: number; direction: ShareDirection; description?: string | null; date?: string },
): Promise<void> {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } });
  if (!contact) throw new NotFoundError("Contact not found");
  const date = input.date ? new Date(`${input.date}T00:00:00`) : new Date();
  await prisma.expenseShare.create({
    data: {
      contactId,
      amount: input.amount,
      direction: input.direction,
      description: input.description?.trim() || null,
      date,
    },
  });
}

/**
 * Mark a share settled. Optionally records the matching real transaction so
 * the cash movement shows in your balances too:
 *   - "owed_to_you" → an Income (they paid you back) into `accountId`
 *   - "you_owe"     → an Expense (you paid them back) from `accountId`
 * Settling without recording only clears the ledger, leaving balances untouched.
 */
export async function settleShare(
  userId: string,
  shareId: string,
  opts: { record?: boolean; accountId?: string | null },
): Promise<void> {
  const share = await prisma.expenseShare.findFirst({
    where: { id: shareId, contact: { userId } },
    include: { transaction: true, contact: true },
  });
  if (!share) throw new NotFoundError("Share not found");
  if (share.settled) return;

  await prisma.expenseShare.update({ where: { id: shareId }, data: { settled: true, settledAt: new Date() } });

  if (opts.record && opts.accountId) {
    const account = await prisma.account.findFirst({ where: { id: opts.accountId, userId }, select: { id: true } });
    if (!account) throw new NotFoundError("Account not found");
    const owed = share.direction !== "you_owe"; // owed_to_you → income
    const label = share.transaction?.description ?? share.description ?? "shared expense";
    await prisma.transaction.create({
      data: {
        userId,
        type: owed ? "income" : "expense",
        amount: share.amount,
        description: owed ? `${share.contact.name} settled up` : `Paid ${share.contact.name} back`,
        date: new Date(),
        accountId: opts.accountId,
        notes: `Settlement for "${label}"`,
      },
    });
  }
}
