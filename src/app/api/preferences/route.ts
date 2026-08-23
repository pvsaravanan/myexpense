import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { assertAccountsOwned } from "@/lib/ownership";
import { preferenceSchema } from "@/lib/validation";

export const PATCH = withUser(async (user, req: NextRequest) => {
  const input = preferenceSchema.parse(await req.json());
  // SECURITY: never store a pointer to another user's account.
  await assertAccountsOwned(user.id, [input.defaultAccountId]);
  const data: Record<string, unknown> = {};
  if (input.theme !== undefined) data.theme = input.theme;
  if (input.dashboardWidgets !== undefined) data.dashboardWidgets = JSON.stringify(input.dashboardWidgets);
  if (input.defaultAccountId !== undefined) data.defaultAccountId = input.defaultAccountId;

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: data,
    create: {
      userId: user.id,
      theme: input.theme ?? "system",
      dashboardWidgets: JSON.stringify(input.dashboardWidgets ?? []),
      defaultAccountId: input.defaultAccountId ?? null,
    },
  });
  return json({ ok: true });
});
