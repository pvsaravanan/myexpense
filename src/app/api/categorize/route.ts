import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { suggestCategory } from "@/lib/categorize";

/** Suggest a category id/name for a free-text description (rule-based). */
export const POST = withUser(async (user, req: NextRequest) => {
  const { description } = (await req.json()) as { description?: string };
  const name = suggestCategory(description ?? "");
  if (!name) return json({ suggestion: null });

  const category = await prisma.category.findFirst({
    where: { userId: user.id, name: { equals: name }, isActive: true },
    select: { id: true, name: true },
  });
  return json({ suggestion: category ? { id: category.id, name: category.name } : { id: null, name } });
});
