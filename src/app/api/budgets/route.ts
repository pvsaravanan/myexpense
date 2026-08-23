import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { budgetSchema } from "@/lib/validation";
import { loadBudget } from "@/lib/queries";

export const GET = withUser(async (user, req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  const now = new Date();
  const year = Number(params.get("year")) || now.getFullYear();
  const month = Number(params.get("month")) || now.getMonth() + 1;
  return json({ budget: await loadBudget(user.id, year, month) });
});

/** Upsert the budget for a month, replacing its category limits. */
export const PUT = withUser(async (user, req: NextRequest) => {
  const input = budgetSchema.parse(await req.json());

  // Only keep category limits for categories the user actually owns.
  const owned = await prisma.category.findMany({
    where: { userId: user.id, id: { in: input.categories.map((c) => c.categoryId) } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));
  // Dedupe by categoryId — the table has @@unique([budgetId, categoryId]), so a
  // repeated id would otherwise fail createMany with an unhandled P2002.
  const byCategory = new Map<string, number>();
  for (const c of input.categories) {
    if (ownedIds.has(c.categoryId)) byCategory.set(c.categoryId, c.limit);
  }
  const cats = [...byCategory].map(([categoryId, limit]) => ({ categoryId, limit }));

  await prisma.$transaction(async (db) => {
    const budget = await db.budget.upsert({
      where: { userId_year_month: { userId: user.id, year: input.year, month: input.month } },
      update: { overallLimit: input.overallLimit ?? null },
      create: { userId: user.id, year: input.year, month: input.month, overallLimit: input.overallLimit ?? null },
    });
    await db.budgetCategory.deleteMany({ where: { budgetId: budget.id } });
    if (cats.length) {
      await db.budgetCategory.createMany({
        data: cats.map((c) => ({ budgetId: budget.id, categoryId: c.categoryId, limit: c.limit })),
      });
    }
  });

  return json({ budget: await loadBudget(user.id, input.year, input.month) });
});
