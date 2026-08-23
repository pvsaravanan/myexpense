import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ConflictError, json, withUser } from "@/lib/api";
import { assertCategoriesOwned } from "@/lib/ownership";
import { categorySchema } from "@/lib/validation";
import { loadCategories } from "@/lib/queries";

export const GET = withUser(async (user) => {
  return json({ categories: await loadCategories(user.id) });
});

export const POST = withUser(async (user, req: NextRequest) => {
  const input = categorySchema.parse(await req.json());
  // SECURITY: a parent category must belong to this user.
  await assertCategoriesOwned(user.id, [input.parentId]);
  // The DB @@unique([userId, name]) is case-SENSITIVE, so also reject
  // case-insensitive collisions here (e.g. CSV import resolves category names to
  // ids via a Map keyed by lowercased name; a collision would attach
  // transactions to the wrong one).
  const clash = await prisma.category.findFirst({
    where: { userId: user.id, name: { equals: input.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) throw new ConflictError("A category with this name already exists");
  const count = await prisma.category.count({ where: { userId: user.id } });
  const created = await prisma.category.create({
    data: {
      userId: user.id,
      name: input.name,
      icon: input.icon,
      color: input.color,
      kind: input.kind,
      monthlyBudget: input.monthlyBudget ?? null,
      parentId: input.parentId ?? null,
      isActive: input.isActive,
      sortOrder: count,
    },
  });
  // Return the created id so callers don't have to resolve it by name — a
  // case-insensitive name match can otherwise return a different pre-existing
  // category with the same name.
  return json({ createdId: created.id, categories: await loadCategories(user.id) }, { status: 201 });
});
