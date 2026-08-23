"use client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "./page-header";
import { MonthNav } from "./month-nav";
import { NetSavingsBars, CategoryChangeBars, SpendingPaceLine, SavingsGauge } from "@/components/charts/chart-kit";
import { formatINR, formatPercent } from "@/lib/money";
import type { MonthKey } from "@/lib/dates";

export interface TrendsData {
  monthKey: MonthKey;
  isCurrent: boolean;
  netTrend: { label: string; net: number }[];
  categoryChange: { name: string; delta: number }[];
  pace: { label: string; cumulative: number; ideal: number | null }[];
  budget: number | null;
  spent: number;
  savingsRate: number;
  budgetUsedPct: number | null;
  topShare: number | null;
  topName: string | null;
}

function Meter({ label, pct, hint, tone }: { label: string; pct: number | null; hint?: string; tone: "brand" | "warning" | "expense" }) {
  return (
    <div className="rounded-none border border-border bg-surface p-4 [container-type:inline-size]">
      <p className="text-label-sm uppercase text-muted">{label}</p>
      <p className="mt-1 whitespace-nowrap font-bold tabular-nums text-fg text-[clamp(1rem,9cqi,1.5rem)]">
        {pct === null ? "—" : formatPercent(pct)}
      </p>
      <Progress value={pct ?? 0} tone={tone} className="mt-2" />
      {hint && <p className="mt-1.5 text-2xs text-faint">{hint}</p>}
    </div>
  );
}

export function TrendsView(props: TrendsData) {
  const { monthKey, isCurrent, netTrend, categoryChange, pace, budget, spent, savingsRate, budgetUsedPct, topShare, topName } = props;

  const overBudget = budget !== null && spent > budget;
  const paceCaption = budget === null
    ? "Set a monthly budget to see your pace against it."
    : overBudget
    ? `Over budget by ${formatINR(spent - budget)} so far.`
    : `${formatINR(budget - spent)} of budget left this month.`;

  const budgetTone: "brand" | "warning" | "expense" =
    budgetUsedPct === null ? "brand" : budgetUsedPct > 100 ? "expense" : budgetUsedPct >= 90 ? "warning" : "brand";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trends"
        description="How your income, spending and savings move over time."
        actions={<MonthNav monthKey={monthKey} isCurrent={isCurrent} className="w-full sm:w-auto" />}
      />

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        {/* Net savings trend — full width time series */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Net savings" subtitle="Income minus expenses, last 12 months" />
          <CardBody className="pt-2">
            <NetSavingsBars data={netTrend} />
          </CardBody>
        </Card>

        {/* Spending pace vs budget */}
        <Card className="min-w-0">
          <CardHeader title="Spending pace" subtitle="Cumulative spend this month" />
          <CardBody className="pt-2">
            <SpendingPaceLine data={pace} budget={budget} />
            <p className="mt-2 text-body-sm text-muted">{paceCaption}</p>
          </CardBody>
        </Card>

        {/* This vs last month by category */}
        <Card className="min-w-0">
          <CardHeader title="Category change" subtitle="Net spend vs last month" />
          <CardBody className="pt-2">
            {categoryChange.length ? (
              <CategoryChangeBars data={categoryChange} />
            ) : (
              <EmptyState title="Not enough history" description="Once you have two months of transactions, changes show up here." />
            )}
          </CardBody>
        </Card>

        {/* Savings health: gauge + meters */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Savings health" subtitle="Where this month stands" />
          <CardBody>
            <div className="grid items-center gap-5 sm:grid-cols-2">
              <SavingsGauge value={savingsRate} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Meter
                  label="Budget used"
                  pct={budgetUsedPct}
                  tone={budgetTone}
                  hint={budget === null ? "No budget set" : `${formatINR(spent)} of ${formatINR(budget)}`}
                />
                <Meter
                  label="Top category"
                  pct={topShare}
                  tone="brand"
                  hint={topName ? `${topName} — share of spend` : "No spending yet"}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
