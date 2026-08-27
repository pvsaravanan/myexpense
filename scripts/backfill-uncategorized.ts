import { prisma } from "../src/lib/db";

/**
 * One-off data fix: category is now mandatory going forward (see
 * transactionSchema in validation.ts), but existing rows created before that
 * change can still have categoryId = null — shown in the UI as
 * "Uncategorized". This assigns every such row to that user's "Other"
 * category (the same catch-all seeded for every new account; see
 * DEFAULT_CATEGORIES in constants.ts), creating one if it's missing.
 *
 * Only touches expense/income/refund rows — transfers have no category by
 * design (they move money between the user's own accounts) and are left
 * alone. Soft-deleted rows are left alone too.
 *
 * Safe to re-run: once a user's null rows are gone, it's a no-op for them.
 * Pass --dry-run to preview counts without writing anything.
 */

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const usersWithNulls = await prisma.transaction.groupBy({
    by: ["userId"],
    where: { categoryId: null, deletedAt: null, type: { in: ["expense", "income", "refund"] } },
    _count: { _all: true },
  });

  if (usersWithNulls.length === 0) {
    console.log("No uncategorized transactions found. Nothing to do.");
    return;
  }

  console.log(`Found uncategorized transactions for ${usersWithNulls.length} user(s):`);
  for (const u of usersWithNulls) console.log(`  ${u.userId}: ${u._count._all}`);

  if (DRY_RUN) {
    console.log("\n--dry-run: no changes made.");
    return;
  }

  let totalUpdated = 0;
  for (const u of usersWithNulls) {
    let other = await prisma.category.findFirst({
      where: { userId: u.userId, name: { equals: "Other", mode: "insensitive" } },
    });
    if (!other) {
      other = await prisma.category.create({
        data: { userId: u.userId, name: "Other", icon: "circle-dot", color: "#8a8578", kind: "both", isSystem: true },
      });
      console.log(`  Created "Other" category for user ${u.userId}`);
    }

    const result = await prisma.transaction.updateMany({
      where: { userId: u.userId, categoryId: null, deletedAt: null, type: { in: ["expense", "income", "refund"] } },
      data: { categoryId: other.id },
    });
    console.log(`  ${u.userId}: assigned ${result.count} transaction(s) to "${other.name}"`);
    totalUpdated += result.count;
  }

  console.log(`\nDone. ${totalUpdated} transaction(s) updated.`);
}

main()
  .catch((e) => {
    console.error("Error backfilling categories:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
