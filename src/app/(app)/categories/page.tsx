import { requireUserOrRedirect } from "@/lib/auth";
import { loadCategories } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { CategoriesView } from "@/components/app/categories-view";

export const metadata = { title: "Categories · MyExpense" };

export default async function CategoriesPage() {
  const user = await requireUserOrRedirect();
  const categories = await loadCategories(user.id);

  return (
    <div>
      <PageHeader title="Categories" description="Organize spending and income, and set monthly budgets." />
      <CategoriesView categories={categories} />
    </div>
  );
}
