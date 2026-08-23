import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ConflictError, json, withUser } from "@/lib/api";
import { accountSchema } from "@/lib/validation";
import { loadAccounts } from "@/lib/queries";

export const GET = withUser(async (user) => {
  return json({ accounts: await loadAccounts(user.id) });
});

export const POST = withUser(async (user, req: NextRequest) => {
  const input = accountSchema.parse(await req.json());
  // The DB @@unique([userId, name]) is case-SENSITIVE, so also reject
  // case-insensitive collisions here (e.g. CSV import resolves account names to
  // ids via a Map keyed by lowercased name; a collision would attach
  // transactions to the wrong one).
  const clash = await prisma.account.findFirst({
    where: { userId: user.id, name: { equals: input.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) throw new ConflictError("An account with this name already exists");
  const count = await prisma.account.count({ where: { userId: user.id } });
  await prisma.account.create({
    data: {
      userId: user.id,
      name: input.name,
      type: input.type,
      openingBalance: input.openingBalance,
      color: input.color,
      icon: input.icon,
      sortOrder: count,
    },
  });
  return json({ accounts: await loadAccounts(user.id) }, { status: 201 });
});
