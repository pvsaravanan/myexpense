import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { createTransaction } from "@/lib/tx-service";
import { transactionSchema } from "@/lib/validation";
import { serializeTransaction } from "@/lib/serialize";
import { buildWhere, toFiniteInt } from "@/lib/query";

export const GET = withUser(async (user, req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  const where = buildWhere(user.id, params);
  // Clamp paging params: a NaN or negative `take` (Prisma reads a negative take
  // as "from the end", a confusing result) or a negative `skip` must not reach
  // the query.
  const take = Math.min(Math.max(toFiniteInt(params.get("take")) ?? 100, 1), 500);
  const skip = Math.max(toFiniteInt(params.get("skip")) ?? 0, 0);

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { tags: { include: { tag: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
      skip,
    }),
    prisma.transaction.count({ where }),
  ]);

  return json({ transactions: rows.map(serializeTransaction), total });
});

export const POST = withUser(async (user, req: NextRequest) => {
  const input = transactionSchema.parse(await req.json());
  const id = await createTransaction(user.id, input);
  const row = await prisma.transaction.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  return json({ transaction: serializeTransaction(row!) }, { status: 201 });
});
