import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { SettingsView } from "@/components/app/settings-view";

export const metadata = { title: "Settings · MyExpense" };

export default async function SettingsPage() {
  await getCurrentUser();
  return (
    <div>
      <PageHeader title="Settings" description="Personalize MyExpense and manage your data." />
      <SettingsView />
    </div>
  );
}
