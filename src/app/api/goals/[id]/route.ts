import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, NotFoundError, withUser } from "@/lib/api";
import { assertAccountsOwned } from "@/lib/ownership";
import { goalSchema } from "@/lib/validation";
import { loadGoals } from "@/lib/queries";
import { fromISODate } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

async function owned(userId: string, id: string) {
  const g = await prisma.financialGoal.findFirst({ where: { id, userId } });
  if (!g) throw new NotFoundError("Goal not found");
  return g;
}

export const PATCH = withUser(async (user, req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await owned(user.id, id);
  const input = goalSchema.partial().parse(await req.json());
  // SECURITY: owning the goal does not make a newly linked account owned.
  await assertAccountsOwned(user.id, [input.accountId]);
  await prisma.financialGoal.update({
    where: { id },
    data: {
      name: input.name,
      icon: input.icon,
      color: input.color,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate === undefined ? undefined : input.targetDate ? fromISODate(input.targetDate) : null,
      accountId: input.accountId === undefined ? undefined : input.accountId ?? null,
      status: input.status,
    },
  });
  return json({ goals: await loadGoals(user.id) });
});

export const DELETE = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await owned(user.id, id);
  await prisma.financialGoal.delete({ where: { id } });
  return json({ goals: await loadGoals(user.id) });
});
