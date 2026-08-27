import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth";
import { loadCategories } from "@/lib/queries";
import { getCategoryDetail } from "@/lib/analytics";
import { CategoryDetailView } from "@/components/app/category-detail-view";

export const metadata = { title: "Category · baaki" };

type Ctx = { params: Promise<{ id: string }> };

export default async function CategoryDetailPage({ params }: Ctx) {
  const user = await requireUserOrRedirect();
  const { id } = await params;

  const categories = await loadCategories(user.id);
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();

  const detail = await getCategoryDetail(user.id, id);

  return <CategoryDetailView category={category} detail={detail} />;
}
