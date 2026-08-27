import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { SettingsView } from "@/components/app/settings-view";

export const metadata = { title: "Settings · baaki" };

export default async function SettingsPage() {
  await getCurrentUser();
  return (
    <div>
      <PageHeader title="Settings" description="Personalize baaki and manage your data." />
      <SettingsView />
    </div>
  );
}
