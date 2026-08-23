/**
 * One-off migration: copy data from the old local SQLite DB into the current
 * Postgres (Supabase) database configured via DATABASE_URL.
 *
 *   node scripts/migrate-sqlite-to-supabase.mjs
 *
 * - Reads prisma/myexpense.db with the built-in node:sqlite (Node 22.5+).
 * - Preserves ids, so it is safe to re-run (skipDuplicates).
 * - Aborts if the target DB already has users, to avoid a mixed/partial state
 *   (override with FORCE=1 only if you know the ids won't collide).
 * - Skips Session rows (stale auth tokens — just log in again after).
 */
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const SQLITE_PATH = "prisma/myexpense.db";

// Insert parents before children so foreign keys resolve.
const ORDER = [
  "User", "UserPreference", "Account", "Category", "Tag", "Budget",
  "BudgetCategory", "RecurringTransaction", "Transaction", "TransactionTag",
  "FinancialGoal", "GoalContribution",
];

const DELEGATE = {
  User: "user", UserPreference: "userPreference", Account: "account",
  Category: "category", Tag: "tag", Budget: "budget",
  BudgetCategory: "budgetCategory", RecurringTransaction: "recurringTransaction",
  Transaction: "transaction", TransactionTag: "transactionTag",
  FinancialGoal: "financialGoal", GoalContribution: "goalContribution",
};

// SQLite stores booleans as 0/1 and DateTimes as Unix-millisecond numbers.
const BOOL = {
  Account: ["isArchived"],
  Category: ["isActive", "isSystem"],
  RecurringTransaction: ["isActive", "autoPost"],
};
const DATES = {
  User: ["createdAt", "updatedAt"],
  Account: ["createdAt", "updatedAt"],
  Category: ["createdAt", "updatedAt"],
  Budget: ["createdAt", "updatedAt"],
  RecurringTransaction: ["startDate", "endDate", "nextOccurrence", "lastPostedDate", "createdAt", "updatedAt"],
  Transaction: ["date", "createdAt", "updatedAt", "deletedAt"],
  FinancialGoal: ["targetDate", "createdAt", "updatedAt"],
  GoalContribution: ["date", "createdAt"],
};

function convert(table, row) {
  const out = { ...row };
  for (const f of BOOL[table] ?? []) if (out[f] != null) out[f] = Boolean(out[f]);
  for (const f of DATES[table] ?? []) if (out[f] != null) out[f] = new Date(out[f]);
  return out;
}

const src = new DatabaseSync(SQLITE_PATH, { readOnly: true });
const prisma = new PrismaClient();

try {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0 && process.env.FORCE !== "1") {
    console.error(
      `Target DB already has ${existingUsers} user(s). Aborting to avoid a mixed state.\n` +
      `Reset it first (npm run db:reset) or set FORCE=1 if you're sure ids won't collide.`,
    );
    process.exit(1);
  }

  for (const table of ORDER) {
    const rows = src.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length === 0) continue;
    const delegate = prisma[DELEGATE[table]];

    if (table === "Category") {
      // parentId is a self-reference; insert all with parentId null first, then
      // wire up parents in a second pass so no row references a not-yet-inserted one.
      const data = rows.map((r) => ({ ...convert(table, r), parentId: null }));
      await delegate.createMany({ data, skipDuplicates: true });
      const children = rows.filter((r) => r.parentId != null);
      for (const r of children) {
        await delegate.update({ where: { id: r.id }, data: { parentId: r.parentId } });
      }
    } else {
      const data = rows.map((r) => convert(table, r));
      await delegate.createMany({ data, skipDuplicates: true });
    }
    console.log(`${table}: migrated ${rows.length}`);
  }

  console.log("\nDone. Verifying target counts:");
  for (const table of ORDER) {
    const c = await prisma[DELEGATE[table]].count();
    if (c > 0) console.log(`  ${table}: ${c}`);
  }
} finally {
  src.close();
  await prisma.$disconnect();
}
