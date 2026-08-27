import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { SpendBars, CategoryDonut, BudgetGauge } from "@/components/charts/chart-kit";
import { formatDelta, formatINR } from "@/lib/money";
import type { CategoryDTO } from "@/lib/types";
import type { CategoryDetail } from "@/lib/analytics";

export function CategoryDetailView({ category, detail }: { category: CategoryDTO; detail: CategoryDetail }) {
  const {
    monthly, currentMonthSpent, previousMonthSpent, deltaPct, avgPerMonth,
    totalSpent, transactionCount, shareOfMonthExpenses, monthTotalExpenses, budget, topMerchants,
  } = detail;

  const utilizationPct = budget && budget.limit > 0 ? (budget.spent / budget.limit) * 100 : null;
  const maxMerchant = topMerchants[0]?.total ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/categories"
          className="inline-flex items-center gap-1.5 text-label-sm uppercase text-muted hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Categories
        </Link>
        <div className="mt-2 flex items-center gap-3 border-b border-border pb-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none" style={{ color: category.color }}>
            <Icon name={category.icon} size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-headline-md text-fg sm:text-headline-lg">{category.name}</h1>
            <p className="mt-1 text-body-sm text-muted">
              {!category.isActive && "Inactive · "}
              How this category's spend has moved over time.
            </p>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="This month">
          <Money paise={currentMonthSpent} tone="expense" className="text-headline-sm font-semibold" />
        </Stat>
        <Stat label="vs last month">
          <span className={deltaPct === null ? "text-fg" : deltaPct > 0 ? "text-expense" : deltaPct < 0 ? "text-income" : "text-fg"}>
            {formatDelta(deltaPct)}
          </span>
        </Stat>
        <Stat label="12-mo average">
          <Money paise={avgPerMonth} tone="default" className="text-headline-sm font-semibold" />
        </Stat>
        <Stat label="All-time spend">
          <Money paise={totalSpent} tone="default" className="text-headline-sm font-semibold" />
        </Stat>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        {/* Monthly trend — full width */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Monthly spend" subtitle="Last 12 months" />
          <CardBody className="pt-2">
            {totalSpent > 0 ? (
              <SpendBars data={monthly.map((m) => ({ label: m.label, value: m.net }))} color={category.color} />
            ) : (
              <EmptyState title="No spending yet" description="Once you record a transaction in this category, its trend shows up here." />
            )}
          </CardBody>
        </Card>

        {/* Budget utilization, when this category has a budget */}
        {budget && (
          <Card className="min-w-0">
            <CardHeader title="Budget" subtitle="This month" />
            <CardBody>
              <div className="flex flex-col items-center gap-2">
                <BudgetGauge value={utilizationPct ?? 0} />
                <p className="text-body-sm text-muted">
                  {formatINR(budget.spent)} of {formatINR(budget.limit)}
                  {budget.status.state === "over" && (
                    <span className="ml-1 font-medium text-expense">— over by {formatINR(-budget.status.remaining)}</span>
                  )}
                </p>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Share of this month's total spend */}
        <Card className="min-w-0">
          <CardHeader title="Share of spending" subtitle="This month, vs everything else" />
          <CardBody className="pt-2">
            {shareOfMonthExpenses !== null ? (
              <div className="flex flex-col items-center gap-2">
                <CategoryDonut
                  data={[
                    { name: category.name, value: currentMonthSpent, color: category.color },
                    { name: "Everything else", value: Math.max(0, monthTotalExpenses - currentMonthSpent), color: "#94a3b8" },
                  ]}
                  height={200}
                />
                <p className="text-body-sm text-muted">
                  <span className="font-semibold text-fg">{shareOfMonthExpenses.toFixed(1)}%</span> of this month's spending
                </p>
              </div>
            ) : (
              <EmptyState title="No spending this month" description="This category's share of spend will show up once you record something." />
            )}
          </CardBody>
        </Card>

        {/* Top merchants/descriptions within this category */}
        <Card className={budget ? "min-w-0" : "min-w-0 lg:col-span-2"}>
          <CardHeader title="Where it goes" subtitle="Top merchants in this category (expenses only)" />
          <CardBody className="space-y-2.5 pt-2">
            {topMerchants.length === 0 ? (
              <EmptyState title="Nothing to show yet" description="Merchant totals appear once you have a few expenses here." />
            ) : (
              topMerchants.map((m) => (
                <div key={m.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-body-sm">
                    <span className="min-w-0 truncate text-fg">{m.label}</span>
                    <span className="tnum shrink-0 font-medium text-fg">{formatINR(m.total)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-2">
                    <div
                      className="h-1.5"
                      style={{
                        width: `${maxMerchant > 0 ? (m.total / maxMerchant) * 100 : 0}%`,
                        backgroundColor: category.color,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <p className="text-2xs text-faint">
        {transactionCount} transaction{transactionCount === 1 ? "" : "s"} in this category, last month {formatINR(previousMonthSpent)}.
      </p>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-none border border-border bg-surface p-4 [container-type:inline-size]">
      <p className="text-label-sm uppercase text-muted">{label}</p>
      <p className="mt-1 whitespace-nowrap tabular-nums text-[clamp(1rem,9cqi,1.5rem)]">{children}</p>
    </div>
  );
}
