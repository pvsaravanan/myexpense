/**
 * Shared transaction filter builder. Used by both the list API
 * (/api/transactions) and the CSV export (/api/export).
 */
import type { Prisma } from "@prisma/client";
import { fromISODate } from "./dates";

/** Parse a query param as a finite integer, or null when absent/non-numeric. */
export function toFiniteInt(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Build a Prisma where-clause from URL filter params. */
export function buildWhere(userId: string, params: URLSearchParams): Prisma.TransactionWhereInput {
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
    if (min !== null) amt.gte = min;
    if (max !== null) amt.lte = max;
    if (Object.keys(amt).length) where.amount = amt;
  }

  const q = params.get("q")?.trim();
  if (q) {
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
