import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { softDeleteSplitGroup, updateSplitTransaction } from "@/lib/tx-service";
import { splitTransactionSchema } from "@/lib/validation";
import { serializeTransaction } from "@/lib/serialize";

type Ctx = { params: Promise<{ groupId: string }> };

const INCLUDE = { tags: { include: { tag: true } }, shares: { include: { contact: true } } } as const;

/** All parts of one split expense, for the edit form. */
export const GET = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { groupId } = await ctx.params;
  const rows = await prisma.transaction.findMany({
    where: { userId: user.id, splitGroupId: groupId, deletedAt: null },
    include: INCLUDE,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return json({ transactions: rows.map(serializeTransaction) });
});

export const PATCH = withUser(async (user, req: NextRequest, ctx: Ctx) => {
  const { groupId } = await ctx.params;
  const input = splitTransactionSchema.parse(await req.json());
  const ids = await updateSplitTransaction(user.id, groupId, input);
  const rows = await prisma.transaction.findMany({
    where: { id: { in: ids } },
    include: INCLUDE,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return json({ transactions: rows.map(serializeTransaction) });
});

export const DELETE = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { groupId } = await ctx.params;
  await softDeleteSplitGroup(user.id, groupId);
  return json({ ok: true });
});
