import { requireUserOrRedirect } from "@/lib/auth";
import { getMonthlyAnalytics } from "@/lib/analytics";
import { monthKeyOf, daysInMonth, parseMonthKey, type MonthKey } from "@/lib/dates";
import { TrendsView } from "@/components/app/trends-view";

export const metadata = { title: "Trends · Baaki" };

export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUserOrRedirect();
  const { m } = await searchParams;
  const nowKey = monthKeyOf(new Date());
  const monthKey: MonthKey = parseMonthKey(m) ?? nowKey;
  const isCurrent = monthKey.year === nowKey.year && monthKey.month === nowKey.month;

  const a = await getMonthlyAnalytics(user.id, monthKey);
  const budget = a.budget.overallLimit;
  const spent = a.budget.overallSpent;
  const daysInMo = daysInMonth(monthKey);

  let cum = 0;
  const pace = a.daily.map((d) => {
    cum += d.expense;
    const dayNum = Number(d.date.slice(-2));
    return {
      label: String(dayNum),
      cumulative: cum,
      ideal: budget ? Math.round((budget * dayNum) / daysInMo) : null,
    };
  });

  return (
    <TrendsView
      monthKey={monthKey}
      isCurrent={isCurrent}
      netTrend={a.incomeExpenseTrend.map((t) => ({ label: t.label, net: t.income - t.expense }))}
      categoryChange={a.categoryComparison.map((c) => ({ name: c.name, delta: c.delta }))}
      pace={pace}
      budget={budget}
      spent={spent}
      savingsRate={a.current.savingsRate}
      budgetUsedPct={budget && budget > 0 ? (spent / budget) * 100 : null}
      topShare={a.current.effectiveExpense > 0 && a.categories[0] ? (a.categories[0].net / a.current.effectiveExpense) * 100 : null}
      topName={a.categories[0]?.name ?? null}
    />
  );
}
