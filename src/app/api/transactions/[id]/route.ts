import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { softDeleteTransaction, updateTransaction } from "@/lib/tx-service";
import { transactionSchema } from "@/lib/validation";
import { serializeTransaction } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser(async (user, req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = transactionSchema.parse(await req.json());
  await updateTransaction(user.id, id, input);
  const row = await prisma.transaction.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  return json({ transaction: serializeTransaction(row!) });
});

export const DELETE = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await softDeleteTransaction(user.id, id);
  return json({ ok: true });
});
