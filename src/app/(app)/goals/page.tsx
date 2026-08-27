import { requireUserOrRedirect } from "@/lib/auth";
import { loadGoals } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { GoalsView } from "@/components/app/goals-view";

export const metadata = { title: "Goals · baaki" };

export default async function GoalsPage() {
  const user = await requireUserOrRedirect();
  const goals = await loadGoals(user.id);

  return (
    <div>
      <PageHeader title="Goals" description="Set savings targets and track your progress toward them." />
      <GoalsView goals={goals} />
    </div>
  );
}
