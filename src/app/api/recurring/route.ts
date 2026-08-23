import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { assertAccountsOwned, assertCategoriesOwned } from "@/lib/ownership";
import { recurringSchema } from "@/lib/validation";
import { loadRecurring } from "@/lib/queries";
import { computeNextOccurrence } from "@/lib/recurring";
import { fromISODate } from "@/lib/dates";
import type { Frequency } from "@/lib/constants";

export const GET = withUser(async (user) => {
  return json({ recurring: await loadRecurring(user.id) });
});

export const POST = withUser(async (user, req: NextRequest) => {
  const input = recurringSchema.parse(await req.json());

  // SECURITY: verify every client-supplied foreign key belongs to this user.
  await assertAccountsOwned(user.id, [input.accountId, input.transferAccountId]);
  await assertCategoriesOwned(user.id, [input.categoryId]);

  const startDate = fromISODate(input.startDate)!;
  const next = computeNextOccurrence(startDate, input.frequency as Frequency, input.interval, new Date());

  await prisma.recurringTransaction.create({
    data: {
      userId: user.id,
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
  return json({ recurring: await loadRecurring(user.id) }, { status: 201 });
});
