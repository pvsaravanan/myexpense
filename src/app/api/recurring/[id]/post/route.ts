import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, json, NotFoundError, withUser } from "@/lib/api";
import { loadRecurring } from "@/lib/queries";
import { postOccurrence } from "@/lib/recurring";

type Ctx = { params: Promise<{ id: string }> };

/** Post the current occurrence now, creating a real transaction. */
export const POST = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const rule = await prisma.recurringTransaction.findFirst({ where: { id, userId: user.id } });
  if (!rule) throw new NotFoundError("Recurring transaction not found");
  if (!rule.isActive) return apiError("This rule is paused. Resume it before posting.", 409);
  if (rule.endDate && rule.nextOccurrence.getTime() > rule.endDate.getTime()) {
    return apiError("This rule has ended.", 409);
  }
  const posted = await postOccurrence(rule, rule.nextOccurrence);
  if (posted === null) return apiError("This occurrence was already posted.", 409);
  return json({ recurring: await loadRecurring(user.id) });
});
