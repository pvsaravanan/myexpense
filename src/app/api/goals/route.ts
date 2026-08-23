import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { assertAccountsOwned } from "@/lib/ownership";
import { goalSchema } from "@/lib/validation";
import { loadGoals } from "@/lib/queries";
import { fromISODate } from "@/lib/dates";

export const GET = withUser(async (user) => {
  return json({ goals: await loadGoals(user.id) });
});

export const POST = withUser(async (user, req: NextRequest) => {
  const input = goalSchema.parse(await req.json());
  // SECURITY: a goal may link to an account — verify it is this user's.
  await assertAccountsOwned(user.id, [input.accountId]);
  await prisma.financialGoal.create({
    data: {
      userId: user.id,
      name: input.name,
      icon: input.icon,
      color: input.color,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate ? fromISODate(input.targetDate) : null,
      accountId: input.accountId ?? null,
      status: input.status,
      contributions:
        input.initialAmount > 0
          ? { create: { amount: input.initialAmount, note: "Starting amount" } }
          : undefined,
    },
  });
  return json({ goals: await loadGoals(user.id) }, { status: 201 });
});
