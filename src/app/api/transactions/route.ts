import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { createTransaction } from "@/lib/tx-service";
import { transactionSchema } from "@/lib/validation";
import { serializeTransaction } from "@/lib/serialize";
import { fromISODate } from "@/lib/dates";
import type { Prisma } from "@prisma/client";

/** Parse a query param as a finite integer, or null when absent/non-numeric. */
function toFiniteInt(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Build a Prisma where-clause from URL filter params. */
function buildWhere(userId: string, params: URLSearchParams): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId, deletedAt: null };
  const and: Prisma.TransactionWhereInput[] = [];

  const start = params.get("start");
  const end = params.get("end");
  if (start || end) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (start) {
      const d = fromISODate(start);
      if (d) dateFilter.gte = d;
    }
    if (end) {
      const d = fromISODate(end);
      if (d) {
        d.setDate(d.getDate() + 1); // make `end` inclusive of the whole day
        dateFilter.lt = d;
      }
    }
    where.date = dateFilter;
  }

  const csv = (key: string) => params.get(key)?.split(",").filter(Boolean) ?? [];
  const types = csv("type");
  if (types.length) where.type = { in: types };
  const accounts = csv("accountId");
  if (accounts.length) where.accountId = { in: accounts };
  const methods = csv("paymentMethod");
  if (methods.length) where.paymentMethod = { in: methods };

  const categories = csv("categoryId");
  if (categories.length) {
    if (categories.includes("none")) {
      where.categoryId = { in: [...categories.filter((c) => c !== "none")] };
      and.push({ OR: [{ categoryId: null }, { categoryId: { in: categories } }] });
      delete where.categoryId;
    } else {
      where.categoryId = { in: categories };
    }
  }

  const min = toFiniteInt(params.get("min"));
  const max = toFiniteInt(params.get("max"));
  if (min !== null || max !== null) {
    const amt: Prisma.IntFilter = {};
    // Ignore non-numeric input (Number("abc") is NaN, which Prisma rejects at
    // runtime as an unhandled 500) rather than passing it through.
    if (min !== null) amt.gte = min;
    if (max !== null) amt.lte = max;
    if (Object.keys(amt).length) where.amount = amt;
  }

  const q = params.get("q")?.trim();
  if (q) {
    // `mode: "insensitive"` is required on Postgres — unlike SQLite, its
    // `contains` (LIKE) is case-sensitive, so search would otherwise miss
    // "Swiggy" when the user types "swiggy".
    and.push({
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { merchant: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const tags = csv("tag");
  if (tags.length) {
    and.push({ tags: { some: { tag: { name: { in: tags } } } } });
  }

  if (and.length) where.AND = and;
  return where;
}

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
