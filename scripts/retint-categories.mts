/**
 * One-off: retint system category colors to the warm College.xyz palette.
 *
 * SAFE BY DESIGN: only updates rows where `isSystem` is true AND the stored
 * color still equals the old seeded default. Any category a user has recoloured
 * (or created themselves) is left untouched.
 *
 *   npx tsx scripts/retint-categories.mts
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_CATEGORIES } from "../src/lib/constants";

const prisma = new PrismaClient();

/** The colors shipped by earlier versions, keyed by category name. */
const OLD_COLORS: Record<string, string[]> = {
  Housing: ["#6366f1"],
  Food: ["#f97316"],
  Groceries: ["#84cc16"],
  Transportation: ["#06b6d4"],
  Education: ["#3b82f6"],
  Healthcare: ["#ef4444"],
  Entertainment: ["#ec4899"],
  Shopping: ["#a855f7"],
  Subscriptions: ["#8b5cf6"],
  "Bills & Utilities": ["#0ea5e9"],
  Travel: ["#14b8a6"],
  Personal: ["#f59e0b"],
  Family: ["#d946ef"],
  "Bank Charges": ["#64748b"],
  Salary: ["#16a34a"],
  Business: ["#0d9488"],
  Investments: ["#22c55e"],
  "Other Income": ["#10b981"],
  Other: ["#94a3b8"],
};

async function main() {
  let updated = 0;
  let skipped = 0;

  for (const def of DEFAULT_CATEGORIES) {
    const olds = OLD_COLORS[def.name];
    if (!olds) continue;
    const res = await prisma.category.updateMany({
      where: { name: def.name, isSystem: true, color: { in: olds } },
      data: { color: def.color },
    });
    updated += res.count;
  }

  skipped = await prisma.category.count({
    where: { isSystem: true, color: { notIn: DEFAULT_CATEGORIES.map((d) => d.color) } },
  });

  console.log(`Retinted ${updated} system categories to the warm palette.`);
  console.log(`Left ${skipped} customised/other categories untouched.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
