import { prisma } from "../src/lib/db";

/**
 * DESTRUCTIVE: wipes every user's transactions, budgets, goals, and recurring
 * rules from the database this script's DATABASE_URL points at — which, by
 * default, is the same SQLite file the running app reads and writes
 * (prisma/myexpense.db). There is no per-user scoping and no undo.
 *
 * Guarded so it cannot run by accident:
 *   1. Requires the literal flag `--yes-delete-everything`.
 *   2. Requires env var CLEAR_DATA_CONFIRM to equal "I understand".
 *   3. Supports `--dry-run` to preview counts without deleting anything.
 */

const DRY_RUN = process.argv.includes("--dry-run");
const CONFIRM_FLAG = "--yes-delete-everything";

async function main() {
  const counts = {
    tags: await prisma.transactionTag.count(),
    txns: await prisma.transaction.count(),
    goalContribs: await prisma.goalContribution.count(),
    goals: await prisma.financialGoal.count(),
    budgetCats: await prisma.budgetCategory.count(),
    budgets: await prisma.budget.count(),
    recurring: await prisma.recurringTransaction.count(),
  };

  console.log("This will PERMANENTLY delete, for ALL users:");
  console.log(`  ${counts.txns} transactions, ${counts.tags} transaction tags`);
  console.log(`  ${counts.goals} goals, ${counts.goalContribs} goal contributions`);
  console.log(`  ${counts.budgets} budgets, ${counts.budgetCats} budget category limits`);
  console.log(`  ${counts.recurring} recurring rules`);
  console.log(`Database: ${process.env.DATABASE_URL ?? "(DATABASE_URL not set)"}`);

  if (DRY_RUN) {
    console.log("\n--dry-run: no changes made.");
    return;
  }

  if (!process.argv.includes(CONFIRM_FLAG) || process.env.CLEAR_DATA_CONFIRM !== "I understand") {
    console.error(
      `\nRefusing to run. This is irreversible and affects every user's data.\n` +
        `Re-run with both:\n` +
        `  1. the flag ${CONFIRM_FLAG}\n` +
        `  2. env var CLEAR_DATA_CONFIRM="I understand"\n` +
        `Or pass --dry-run to preview without deleting.`,
    );
    process.exit(1);
  }

  console.log("\nClearing transactions and financial activity data...");

  const deletedTags = await prisma.transactionTag.deleteMany();
  console.log(`Deleted ${deletedTags.count} transaction tags.`);

  const deletedTxns = await prisma.transaction.deleteMany();
  console.log(`Deleted ${deletedTxns.count} transactions.`);

  const deletedGoalContribs = await prisma.goalContribution.deleteMany();
  console.log(`Deleted ${deletedGoalContribs.count} goal contributions.`);

  const deletedGoals = await prisma.financialGoal.deleteMany();
  console.log(`Deleted ${deletedGoals.count} goals.`);

  const deletedBudgetCats = await prisma.budgetCategory.deleteMany();
  console.log(`Deleted ${deletedBudgetCats.count} budget categories.`);

  const deletedBudgets = await prisma.budget.deleteMany();
  console.log(`Deleted ${deletedBudgets.count} budgets.`);

  const deletedRecurring = await prisma.recurringTransaction.deleteMany();
  console.log(`Deleted ${deletedRecurring.count} recurring transactions.`);

  console.log("\nAll transactions and activity data cleared successfully.");
}

main()
  .catch((e) => {
    console.error("Error clearing data:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
