import { NextRequest } from "next/server";
import { json, withUser } from "@/lib/api";
import { contactSchema } from "@/lib/validation";
import { deleteContact, loadContacts, updateContact } from "@/lib/contacts-service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser(async (user, req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = contactSchema.partial().parse(await req.json());
  await updateContact(user.id, id, input);
  return json({ contacts: await loadContacts(user.id) });
});

export const DELETE = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteContact(user.id, id);
  return json({ contacts: await loadContacts(user.id) });
});
