import { PageHeader } from "@/components/app/page-header";
import { SettingsView } from "@/components/app/settings-view";

export const metadata = { title: "Settings · baaki" };

export default async function SettingsPage() {
  // Auth is handled by the app layout, which redirects to /login if the user
  // is not authenticated. No need to re-verify here — it only adds latency
  // to client-side navigation (the layout's cache doesn't carry over to the
  // page's RSC fetch).
  return (
    <div>
      <PageHeader title="Settings" description="Personalize baaki and manage your data." />
      <SettingsView />
    </div>
  );
}
