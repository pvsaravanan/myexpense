import { requireUserOrRedirect } from "@/lib/auth";
import { loadContacts } from "@/lib/contacts-service";
import { PageHeader } from "@/components/app/page-header";
import { PeopleView } from "@/components/app/people-view";

export const metadata = { title: "People · MyExpense" };

export default async function PeoplePage() {
  const user = await requireUserOrRedirect();
  const contacts = await loadContacts(user.id);

  return (
    <div>
      <PageHeader title="People" description="Track shared expenses and settle up." />
      <PeopleView contacts={contacts} />
    </div>
  );
}
