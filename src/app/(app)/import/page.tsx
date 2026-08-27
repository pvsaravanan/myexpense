import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { ImportView } from "@/components/app/import-view";

export const metadata = { title: "Import · Baaki" };

export default async function ImportPage() {
  await getCurrentUser();
  return (
    <div>
      <PageHeader title="Import transactions" description="Bring in transactions from a CSV file." />
      <ImportView />
    </div>
  );
}
