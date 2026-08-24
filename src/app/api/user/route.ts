import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";

const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
});

/** Update the current user's display name. */
export const PATCH = withUser(async (user, req: NextRequest) => {
  const { name } = userUpdateSchema.parse(await req.json());
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name },
    select: { id: true, name: true, email: true },
  });
  return json({ user: updated });
});
