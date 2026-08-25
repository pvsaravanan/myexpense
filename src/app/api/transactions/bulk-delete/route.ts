import { NextRequest } from "next/server";
import { z } from "zod";
import { json, withUser } from "@/lib/api";
import { bulkSoftDeleteTransactions } from "@/lib/tx-service";

const bulkDeleteSchema = z.object({ ids: z.array(z.string()).min(1) });

export const POST = withUser(async (user, req: NextRequest) => {
  const { ids } = bulkDeleteSchema.parse(await req.json());
  const count = await bulkSoftDeleteTransactions(user.id, ids);
  return json({ ok: true, count });
});
