import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { duplicateTransaction } from "@/lib/tx-service";
import { serializeTransaction } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const newId = await duplicateTransaction(user.id, id);
  const row = await prisma.transaction.findUnique({
    where: { id: newId },
    include: { tags: { include: { tag: true } } },
  });
  return json({ transaction: serializeTransaction(row!) }, { status: 201 });
});
