import { requireUserOrRedirect } from "@/lib/auth";
import { loadAccounts } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { AccountsView } from "@/components/app/accounts-view";

export const metadata = { title: "Accounts · MyExpense" };

export default async function AccountsPage() {
  const user = await requireUserOrRedirect();
  const accounts = await loadAccounts(user.id);

  return (
    <div>
      <PageHeader title="Accounts" description="Track balances across your banks, cash and cards." />
      <AccountsView accounts={accounts} />
    </div>
  );
}
