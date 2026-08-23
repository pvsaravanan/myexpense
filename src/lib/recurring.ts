import "server-only";
import type { RecurringTransaction } from "@prisma/client";
import { prisma } from "./db";
import { findOccurrenceIndex, occurrenceAt, startOfDay } from "./dates";
import type { Frequency } from "./constants";

/**
 * First occurrence on or after `from`, anchored to `startDate` (see
 * `occurrenceAt` for why anchoring — not chaining forward from the previous
 * occurrence — matters for month-end dates).
 */
export function computeNextOccurrence(
  startDate: Date,
  frequency: Frequency,
  interval: number,
  from: Date,
): Date {
  const start = startOfDay(startDate);
  const n = findOccurrenceIndex(start, frequency, interval, startOfDay(from));
  return occurrenceAt(start, frequency, interval, n);
}

/** The next `count` occurrences from a recurring rule (for display). */
export function upcomingOccurrences(
  rule: Pick<RecurringTransaction, "startDate" | "frequency" | "interval" | "endDate" | "nextOccurrence">,
  from: Date,
  count: number,
): Date[] {
  const start = startOfDay(rule.startDate);
  const freq = rule.frequency as Frequency;
  const fromTime = startOfDay(from);
  const nextTime = startOfDay(rule.nextOccurrence);
  const target = fromTime.getTime() > nextTime.getTime() ? fromTime : nextTime;
  const endTime = rule.endDate ? startOfDay(rule.endDate).getTime() : null;

  let n = findOccurrenceIndex(start, freq, rule.interval, target);
  const out: Date[] = [];
  let guard = 0;
  while (out.length < count && guard < 10_000) {
    guard += 1;
    const occ = occurrenceAt(start, freq, rule.interval, n);
    if (endTime !== null && occ.getTime() > endTime) break;
    out.push(occ);
    n += 1;
  }
  return out;
}

/**
 * Post one occurrence of a recurring rule as a real transaction and advance the
 * rule's nextOccurrence. Returns the created transaction id.
 */
/**
 * Post one occurrence and advance the rule, atomically.
 *
 * CONCURRENCY: the schedule advance is guarded by an optimistic lock on
 * `nextOccurrence` (updateMany ... where nextOccurrence = the value we read).
 * If a concurrent request already advanced the rule, zero rows match, we abort
 * the transaction and post nothing — otherwise both requests would create the
 * same transaction and duplicate real money.
 *
 * Returns the new transaction id, or null when another request won the race.
 */
export async function postOccurrence(
  rule: RecurringTransaction,
  date: Date,
): Promise<string | null> {
  const expected = rule.nextOccurrence;
  // Anchor to the rule's original startDate rather than chaining forward
  // from `date` — see `occurrenceAt` for why chaining causes permanent
  // day-of-month drift after a short month clamps it.
  const start = startOfDay(rule.startDate);
  const freq = rule.frequency as Frequency;
  const n = findOccurrenceIndex(start, freq, rule.interval, startOfDay(date));
  const next = occurrenceAt(start, freq, rule.interval, n + 1);

  try {
    return await prisma.$transaction(async (db) => {
      // Claim the occurrence first. This is the lock.
      const claimed = await db.recurringTransaction.updateMany({
        where: { id: rule.id, nextOccurrence: expected },
        data: { lastPostedDate: startOfDay(date), nextOccurrence: next },
      });
      if (claimed.count === 0) throw new OccurrenceAlreadyPosted();

      const txn = await db.transaction.create({
        data: {
          userId: rule.userId,
          type: rule.type,
          amount: rule.amount,
          description: rule.name,
          date: startOfDay(date),
          categoryId: rule.categoryId,
          accountId: rule.accountId,
          transferAccountId: rule.transferAccountId,
          paymentMethod: rule.paymentMethod,
          notes: rule.notes,
          recurringId: rule.id,
        },
      });
      return txn.id;
    });
  } catch (err) {
    if (err instanceof OccurrenceAlreadyPosted) return null;
    throw err;
  }
}

/** Internal signal used to roll back a lost race. */
class OccurrenceAlreadyPosted extends Error {}

/**
 * Auto-post every due occurrence for a user's auto-post rules up to `now`.
 * Idempotent-ish: it advances nextOccurrence as it posts, so re-running only
 * posts occurrences that have since come due. Returns the number posted.
 */
export async function postDueRecurring(userId: string, now: Date): Promise<number> {
  const rules = await prisma.recurringTransaction.findMany({
    where: { userId, isActive: true, autoPost: true, nextOccurrence: { lte: now } },
  });

  let posted = 0;
  for (const rule of rules) {
    let current = await prisma.recurringTransaction.findUnique({ where: { id: rule.id } });
    let guard = 0;
    while (current && current.isActive && current.nextOccurrence.getTime() <= now.getTime() && guard < 1000) {
      guard += 1;
      if (current.endDate && current.nextOccurrence.getTime() > current.endDate.getTime()) {
        await prisma.recurringTransaction.update({ where: { id: current.id }, data: { isActive: false } });
        break;
      }
      const id = await postOccurrence(current, current.nextOccurrence);
      // Another request claimed this occurrence — stop; it owns the catch-up.
      if (id === null) break;
      posted += 1;
      current = await prisma.recurringTransaction.findUnique({ where: { id: current.id } });
    }
  }
  return posted;
}
