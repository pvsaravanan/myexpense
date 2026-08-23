import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, NotFoundError, withUser } from "@/lib/api";
import { assertAccountsOwned, assertCategoriesOwned } from "@/lib/ownership";
import { recurringSchema } from "@/lib/validation";
import { loadRecurring } from "@/lib/queries";
import { computeNextOccurrence } from "@/lib/recurring";
import { fromISODate } from "@/lib/dates";
import type { Frequency } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

async function owned(userId: string, id: string) {
  const r = await prisma.recurringTransaction.findFirst({ where: { id, userId } });
  if (!r) throw new NotFoundError("Recurring transaction not found");
  return r;
}

export const PATCH = withUser(async (user, req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const existing = await owned(user.id, id);
  const input = recurringSchema.parse(await req.json());

  // SECURITY: the rule being owned does not make its new foreign keys owned.
  await assertAccountsOwned(user.id, [input.accountId, input.transferAccountId]);
  await assertCategoriesOwned(user.id, [input.categoryId]);

  const startDate = fromISODate(input.startDate)!;
  // Recompute the next occurrence if schedule fields changed.
  const scheduleChanged =
    startDate.getTime() !== existing.startDate.getTime() ||
    input.frequency !== existing.frequency ||
    input.interval !== existing.interval;
  const next = scheduleChanged
    ? computeNextOccurrence(startDate, input.frequency as Frequency, input.interval, new Date())
    : existing.nextOccurrence;

  await prisma.recurringTransaction.update({
    where: { id },
    data: {
      name: input.name,
      type: input.type,
      amount: input.amount,
      categoryId: input.type === "transfer" ? null : input.categoryId ?? null,
      accountId: input.accountId,
      transferAccountId: input.type === "transfer" ? input.transferAccountId ?? null : null,
      paymentMethod: input.type === "transfer" ? null : input.paymentMethod ?? null,
      notes: input.notes ?? null,
      frequency: input.frequency,
      interval: input.interval,
      startDate,
      endDate: input.endDate ? fromISODate(input.endDate) : null,
      nextOccurrence: next,
      isActive: input.isActive,
      autoPost: input.autoPost,
    },
  });
  return json({ recurring: await loadRecurring(user.id) });
});

export const DELETE = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await owned(user.id, id);
  // Detach any posted transactions, then delete the rule.
  await prisma.$transaction([
    prisma.transaction.updateMany({ where: { recurringId: id }, data: { recurringId: null } }),
    prisma.recurringTransaction.delete({ where: { id } }),
  ]);
  return json({ recurring: await loadRecurring(user.id) });
});
