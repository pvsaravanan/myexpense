import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { createSplitTransaction, createTransaction } from "@/lib/tx-service";
import { splitTransactionSchema, transactionSchema } from "@/lib/validation";
import { serializeTransaction } from "@/lib/serialize";
import { buildWhere, toFiniteInt } from "@/lib/query";

const INCLUDE = { tags: { include: { tag: true } }, shares: { include: { contact: true } } } as const;

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
      include: INCLUDE,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
      skip,
    }),
    prisma.transaction.count({ where }),
  ]);

  return json({ transactions: rows.map(serializeTransaction), total });
});

export const POST = withUser(async (user, req: NextRequest) => {
  const body = await req.json();

  // A body with a `parts` array is a split expense (multiple category/account
  // allocations for one purchase) — a distinct shape from a normal single
  // transaction, so it gets its own schema and service call. An optional
  // `replaceId` converts a previously-saved single transaction into this split.
  if (Array.isArray(body.parts)) {
    const input = splitTransactionSchema.parse(body);
    const replaceId = typeof body.replaceId === "string" ? body.replaceId : undefined;
    const ids = await createSplitTransaction(user.id, input, { replaceId });
    const rows = await prisma.transaction.findMany({
      where: { id: { in: ids } },
      include: INCLUDE,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return json({ transactions: rows.map(serializeTransaction) }, { status: 201 });
  }

  const input = transactionSchema.parse(body);
  const id = await createTransaction(user.id, input);
  const row = await prisma.transaction.findUnique({
    where: { id },
    include: INCLUDE,
  });
  return json({ transaction: serializeTransaction(row!) }, { status: 201 });
});
