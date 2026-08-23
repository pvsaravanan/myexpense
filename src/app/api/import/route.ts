import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, NotFoundError, withUser } from "@/lib/api";
import { dedupeKey, validateImportRows, type ColumnMapping } from "@/lib/csv";
import { endOfDayExclusive, fromISODate, startOfDay, toISODate } from "@/lib/dates";
import { suggestCategory } from "@/lib/categorize";

const importSchema = z.object({
  records: z.array(z.record(z.string(), z.string())).max(5000),
  mapping: z.record(z.string(), z.string()),
  commit: z.boolean().default(false),
  defaultAccountId: z.string().optional().nullable(),
  skipDuplicates: z.boolean().default(true),
  dateFormat: z.enum(["auto", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).default("auto"),
});

/** A validated row resolved to concrete account/category ids, not yet deduped. */
interface Resolved {
  key: string;
  type: string; amount: number; description: string; date: Date;
  categoryId: string | null; accountId: string; paymentMethod: string | null; notes: string | null;
}

/**
 * Dedupe keys for existing rows. Dates are stored from LOCAL calendar
 * components (see fromISODate), so read them back in local time — toISOString()
 * would convert to UTC and shift the day in any non-UTC timezone, making every
 * re-imported row miss its match and re-insert as new.
 */
function keysFrom(rows: { date: Date; amount: number; description: string; type: string }[]): Set<string> {
  return new Set(
    rows.map((t) => dedupeKey({ date: toISODate(t.date), amount: t.amount, description: t.description, type: t.type })),
  );
}

export const POST = withUser(async (user, req: NextRequest) => {
  const input = importSchema.parse(await req.json());
  const validation = validateImportRows(input.records, input.mapping as ColumnMapping, input.dateFormat);

  // Resolve category + account names to ids.
  const [categories, accounts] = await Promise.all([
    prisma.category.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    prisma.account.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const acctByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a.id]));

  // SECURITY: only accept a default account the user actually owns. Account
  // names are resolved from this user's own accounts, so those are safe; the
  // client-supplied id is not and must be verified.
  const ownedAccountIds = new Set(accounts.map((a) => a.id));
  if (input.defaultAccountId && !ownedAccountIds.has(input.defaultAccountId)) {
    throw new NotFoundError("Account not found");
  }
  const fallbackAccount = input.defaultAccountId ?? accounts[0]?.id ?? null;

  const resolved: Resolved[] = [];
  for (const row of validation.valid) {
    const accountId =
      (row.accountName && acctByName.get(row.accountName.toLowerCase())) || fallbackAccount;
    if (!accountId) continue; // no account to attach to

    let categoryId = row.categoryName ? catByName.get(row.categoryName.toLowerCase()) ?? null : null;
    if (!categoryId && row.type !== "transfer") {
      const suggested = suggestCategory(row.description);
      if (suggested) {
        categoryId = catByName.get(suggested.toLowerCase()) ?? null;
      }
    }

    resolved.push({
      key: dedupeKey({ date: row.date, amount: row.amount, description: row.description, type: row.type }),
      type: row.type,
      amount: row.amount,
      description: row.description,
      date: fromISODate(row.date)!,
      categoryId,
      accountId,
      paymentMethod: row.paymentMethod,
      notes: row.notes,
    });
  }

  // Only existing rows on the same calendar day as a batch row can ever be a
  // duplicate (dedupeKey is keyed on the day), so scope the existing-rows read
  // to the batch's date window instead of loading the user's entire history.
  let dedupeWhere: { userId: string; deletedAt: null; date?: { gte: Date; lt: Date } } = {
    userId: user.id,
    deletedAt: null,
  };
  if (resolved.length) {
    let min = resolved[0].date.getTime();
    let max = min;
    for (const r of resolved) {
      const t = r.date.getTime();
      if (t < min) min = t;
      if (t > max) max = t;
    }
    dedupeWhere = { ...dedupeWhere, date: { gte: startOfDay(new Date(min)), lt: endOfDayExclusive(new Date(max)) } };
  }

  if (!input.commit) {
    // Preview only: dedupe against a snapshot read is fine here since nothing
    // is written — the authoritative check happens inside the transaction below.
    const existing = await prisma.transaction.findMany({
      where: dedupeWhere,
      select: { date: true, amount: true, description: true, type: true },
    });
    const existingKeys = keysFrom(existing);
    const seenInBatch = new Set<string>();
    let duplicates = 0;
    let willImport = 0;
    for (const r of resolved) {
      const isDup = existingKeys.has(r.key) || seenInBatch.has(r.key);
      if (isDup) {
        duplicates += 1;
        if (input.skipDuplicates) continue;
      }
      seenInBatch.add(r.key);
      willImport += 1;
    }
    return json({
      preview: true,
      summary: {
        total: validation.total,
        valid: validation.valid.length,
        invalid: validation.invalid.length,
        invalidRows: validation.invalid.slice(0, 50),
        duplicates,
        willImport,
      },
    });
  }

  // Commit: re-check duplicates and insert inside a single transaction so a
  // second concurrent commit of the same file (double-click, client retry)
  // can't both read the same "not yet imported" snapshot and both insert —
  // the second commit's re-read inside its own transaction will see the
  // first commit's rows once it has committed.
  const imported = await prisma.$transaction(async (db) => {
    const existing = await db.transaction.findMany({
      where: dedupeWhere,
      select: { date: true, amount: true, description: true, type: true },
    });
    const existingKeys = keysFrom(existing);
    const seenInBatch = new Set<string>();
    const toCreate: Resolved[] = [];
    for (const r of resolved) {
      const isDup = existingKeys.has(r.key) || seenInBatch.has(r.key);
      if (isDup) {
        if (input.skipDuplicates) continue;
      }
      seenInBatch.add(r.key);
      toCreate.push(r);
    }
    if (toCreate.length) {
      await db.transaction.createMany({
        data: toCreate.map((t) => ({
          userId: user.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          date: t.date,
          categoryId: t.categoryId,
          accountId: t.accountId,
          paymentMethod: t.paymentMethod,
          notes: t.notes,
        })),
      });
    }
    return toCreate.length;
  }, {
    // The default 5s interactive-transaction timeout can be exceeded by a large
    // import over the network round-trip to a remote (Supabase) Postgres, which
    // would fail the whole import; give the read + bulk insert room to finish.
    timeout: 30_000,
    maxWait: 10_000,
  });

  return json({
    preview: false,
    summary: {
      total: validation.total,
      valid: validation.valid.length,
      invalid: validation.invalid.length,
      invalidRows: validation.invalid.slice(0, 50),
      duplicates: resolved.length - imported,
      willImport: imported,
      imported,
    },
  });
});
