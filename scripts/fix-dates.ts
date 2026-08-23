import { prisma } from "../src/lib/db";

async function fixDates() {
  const txs = await prisma.transaction.findMany({
    where: { createdAt: { gte: new Date("2026-08-15T21:00:00.000Z") } },
  });

  let updated = 0;
  for (const t of txs) {
    const iso = t.date.toISOString().slice(0, 10);
    // Patterns like 2026-01-07, 2026-02-07, ..., 2026-12-07 where month and day were swapped
    const m = /^2026-(\d{2})-(07|08)$/.exec(iso);
    if (m) {
      const monthNum = parseInt(m[1], 10);
      const correctDay = String(monthNum).padStart(2, "0");
      const correctIso = `2026-08-${correctDay}`;
      const correctDate = new Date(`${correctIso}T00:00:00.000Z`);

      console.log(`Fixing [${t.description}]: ${iso} -> ${correctIso}`);
      await prisma.transaction.update({
        where: { id: t.id },
        data: { date: correctDate },
      });
      updated++;
    }
  }
  console.log(`\nSuccessfully updated ${updated} transactions.`);
}

fixDates().finally(() => prisma.$disconnect());
