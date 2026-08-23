import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, NotFoundError, withUser } from "@/lib/api";
import { contributionSchema } from "@/lib/validation";
import { loadGoals } from "@/lib/queries";
import { fromISODate } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

/** Add a contribution (or withdrawal, via a negative amount) to a goal. */
export const POST = withUser(async (user, req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = contributionSchema.parse(await req.json());

  // Create the contribution and recompute the achieved/active flag from a fresh
  // total inside one transaction. Reading the prior contributions before the
  // write (as this used to) let two concurrent contributions each miss the
  // other's amount and leave `status` wrong; aggregating post-write instead
  // always reflects every committed contribution.
  await prisma.$transaction(async (db) => {
    const goal = await db.financialGoal.findFirst({
      where: { id, userId: user.id },
      select: { targetAmount: true, status: true },
    });
    if (!goal) throw new NotFoundError("Goal not found");

    await db.goalContribution.create({
      data: {
        goalId: id,
        amount: input.amount,
        date: input.date ? fromISODate(input.date) ?? new Date() : new Date(),
        note: input.note ?? null,
      },
    });

    const agg = await db.goalContribution.aggregate({ where: { goalId: id }, _sum: { amount: true } });
    const total = agg._sum.amount ?? 0;
    if (total >= goal.targetAmount && goal.status === "active") {
      await db.financialGoal.update({ where: { id }, data: { status: "achieved" } });
    } else if (total < goal.targetAmount && goal.status === "achieved") {
      await db.financialGoal.update({ where: { id }, data: { status: "active" } });
    }
  });

  return json({ goals: await loadGoals(user.id) });
});
