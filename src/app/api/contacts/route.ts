import { NextRequest } from "next/server";
import { json, withUser } from "@/lib/api";
import { contactSchema } from "@/lib/validation";
import { createContact, loadContacts } from "@/lib/contacts-service";

export const GET = withUser(async (user) => {
  return json({ contacts: await loadContacts(user.id) });
});

export const POST = withUser(async (user, req: NextRequest) => {
  const input = contactSchema.parse(await req.json());
  await createContact(user.id, input);
  return json({ contacts: await loadContacts(user.id) }, { status: 201 });
});
