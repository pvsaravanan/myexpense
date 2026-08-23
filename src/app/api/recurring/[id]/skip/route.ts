import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, json, NotFoundError, withUser } from "@/lib/api";
import { loadRecurring } from "@/lib/queries";
import { findOccurrenceIndex, occurrenceAt, startOfDay } from "@/lib/dates";
import type { Frequency } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

/** Skip the current occurrence: advance nextOccurrence without posting. */
export const POST = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const rule = await prisma.recurringTransaction.findFirst({ where: { id, userId: user.id } });
  if (!rule) throw new NotFoundError("Recurring transaction not found");
  // Mirror the guards on the post route: a paused or ended rule has no live
  // occurrence to skip.
  if (!rule.isActive) return apiError("This rule is paused. Resume it before skipping.", 409);
  if (rule.endDate && rule.nextOccurrence.getTime() > rule.endDate.getTime()) {
    return apiError("This rule has ended.", 409);
  }
  // Anchor to startDate rather than chaining off nextOccurrence, so a
  // clamped short-month day (e.g. the 31st landing on Feb 28) doesn't
  // permanently drift the schedule — see dates.ts `occurrenceAt`.
  const start = startOfDay(rule.startDate);
  const freq = rule.frequency as Frequency;
  const n = findOccurrenceIndex(start, freq, rule.interval, startOfDay(rule.nextOccurrence));
  const next = occurrenceAt(start, freq, rule.interval, n + 1);
  // Optimistic lock on nextOccurrence (like postOccurrence): if a concurrent
  // post/skip already advanced the rule, zero rows match and we abort rather
  // than clobbering the newer schedule with a stale value.
  const claimed = await prisma.recurringTransaction.updateMany({
    where: { id, nextOccurrence: rule.nextOccurrence },
    data: { nextOccurrence: next },
  });
  if (claimed.count === 0) return apiError("This occurrence already changed. Please refresh.", 409);
  return json({ recurring: await loadRecurring(user.id) });
});
