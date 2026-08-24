import { NextRequest } from "next/server";
import { json, withUser } from "@/lib/api";
import { standaloneShareSchema } from "@/lib/validation";
import { createStandaloneShare, loadContactShares } from "@/lib/contacts-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json({ shares: await loadContactShares(user.id, id) });
});

export const POST = withUser(async (user, req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = standaloneShareSchema.parse(await req.json());
  await createStandaloneShare(user.id, id, input);
  return json({ shares: await loadContactShares(user.id, id) }, { status: 201 });
});
