import { requireUserOrRedirect } from "@/lib/auth";
import { loadRecurring } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { RecurringView } from "@/components/app/recurring-view";

export const metadata = { title: "Recurring · Baaki" };

export default async function RecurringPage() {
  const user = await requireUserOrRedirect();
  const recurring = await loadRecurring(user.id);
  return (
    <div>
      <PageHeader
        title="Recurring"
        description="Automate the bills, subscriptions and income you expect every period."
      />
      <RecurringView recurring={recurring} />
    </div>
  );
}
