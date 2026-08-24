import { NextRequest } from "next/server";
import { z } from "zod";
import { json, withUser } from "@/lib/api";
import { settleShare } from "@/lib/contacts-service";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  // If set, also records the matching real transaction (Income if they owed
  // you, Expense if you owed them) in `accountId` — so the cash movement shows
  // in your balances, not just the ledger.
  record: z.boolean().default(false),
  accountId: z.string().optional().nullable(),
});

export const POST = withUser(async (user, req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const raw = await req.text();
  const input = bodySchema.parse(raw ? JSON.parse(raw) : {});
  await settleShare(user.id, id, input);
  return json({ ok: true });
});
