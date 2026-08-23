import { NextRequest } from "next/server";
import { json, withUser } from "@/lib/api";
import { restoreTransaction } from "@/lib/tx-service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await restoreTransaction(user.id, id);
  return json({ ok: true });
});
