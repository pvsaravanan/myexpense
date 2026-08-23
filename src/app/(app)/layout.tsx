import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadAccounts, loadCategories, loadPreference, loadTags } from "@/lib/queries";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Due recurring rules are posted by the client via POST /api/recurring/run-due
  // (see RunDueRecurring in app-shell). Renders must stay side-effect free.
  const [accounts, categories, tags, preference] = await Promise.all([
    loadAccounts(user.id),
    loadCategories(user.id),
    loadTags(user.id),
    loadPreference(user.id),
  ]);

  return (
    <AppShell data={{ user, accounts, categories, tags, preference }}>{children}</AppShell>
  );
}
