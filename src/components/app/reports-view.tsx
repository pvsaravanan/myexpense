"use client";
import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/ui/misc";
import { Icon } from "@/components/icon";
import { useAppData } from "@/components/app/app-data";
import { IncomeExpenseBars, TrendArea, CategoryDonut } from "@/components/charts/chart-kit";
import { formatPercent } from "@/lib/money";
import { formatAccountType } from "@/lib/constants";
import type { MonthlyAnalytics } from "@/lib/analytics";

/** Analytics with all Date fields serialized to ISO strings (safe for a client component). */
export type ReportsAnalytics = Omit<MonthlyAnalytics, "largestExpense"> & {
  largestExpense:
    | { description: string; amount: number; date: string; categoryName: string | null }
    | null;
};

export interface PerAccountRow {
  accountId: string;
  expense: number; // effective expense this month (paise)
  income: number; // income this month (paise)
  count: number;
}

type ReportType = "overview" | "category" | "account" | "income" | "expense" | "cashflow";

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "category", label: "By category" },
  { value: "account", label: "By account" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
  { value: "cashflow", label: "Cash flow" },
];

export function ReportsView({
  analytics,
  monthLabel,
  perAccount,
}: {
  analytics: ReportsAnalytics;
  monthLabel: string;
  perAccount: PerAccountRow[];
}) {
  const [report, setReport] = useState<ReportType>("overview");

  const reportLabel = REPORT_OPTIONS.find((o) => o.value === report)?.label ?? "Overview";

  return (
    <div className="space-y-5">
      {/* Print-only header: visible in PDF, hidden on screen */}
      <div className="hidden print:block print:mb-2">
        <h1 className="text-xl font-bold text-fg"><span className="text-brand-hover">baaki</span> — {reportLabel} Report</h1>
        <p className="mt-1 text-sm text-muted">{monthLabel}</p>
        <hr className="mt-3 border-border" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="relative w-full sm:w-auto">
          <Segmented value={report} onChange={setReport} options={REPORT_OPTIONS} size="sm" className="w-full sm:w-auto" />
          {/* Fade hint that more tabs sit off-screen — the scrollbar itself is
              hidden, so without this the last tab reads as clipped/broken
              rather than scrollable. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent sm:hidden" aria-hidden />
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/export?format=csv"
            className="flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-2 rounded-none border border-border-strong px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Button variant="outline" onClick={() => window.print()} className="flex-1 sm:flex-none">
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      {report === "overview" && <OverviewReport a={analytics} label={monthLabel} />}
      {report === "category" && <CategoryReport a={analytics} title="Spending by category" />}
      {report === "account" && <AccountReport perAccount={perAccount} />}
      {report === "income" && <IncomeReport a={analytics} />}
      {report === "expense" && <ExpenseReport a={analytics} />}
      {report === "cashflow" && <CashFlowReport a={analytics} />}
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function Tile({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-none border border-border bg-surface p-4 shadow-card [container-type:inline-size]">
      <p className="text-xs font-medium text-muted">{label}</p>
      {/* Fluid size so a large value fits the tile instead of wrapping; text
          values still wrap naturally (no nowrap). */}
      <div className="mt-1.5 font-semibold tabular-nums text-fg text-[clamp(1rem,9.5cqi,1.5rem)]">{children}</div>
      {hint && <p className="mt-1 text-2xs text-faint">{hint}</p>}
    </div>
  );
}

/** Total / Average / Highest / Lowest tiles for a series of money values. */
function DistributionTiles({ values, unit = "amount" }: { values: number[]; unit?: string }) {
  const total = values.reduce((s, v) => s + v, 0);
  const avg = values.length ? Math.round(total / values.length) : 0;
  const highest = values.length ? Math.max(...values) : 0;
  const lowest = values.length ? Math.min(...values) : 0;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Total" hint={`across ${values.length} ${unit}${values.length === 1 ? "" : "s"}`}>
        <Money paise={total} tone="default" />
      </Tile>
      <Tile label="Average">
        <Money paise={avg} tone="default" />
      </Tile>
      <Tile label="Highest">
        <Money paise={highest} tone="default" />
      </Tile>
      <Tile label="Lowest">
        <Money paise={lowest} tone="default" />
      </Tile>
    </div>
  );
}

function dailySeries(a: ReportsAnalytics, key: "expense" | "income") {
  const isMultiMonth = a.daily.length > 31;
  return a.daily.map((d) => {
    // Single month: "1", "2", … "31". Multi-month: "Jun 1", "Jun 15", …
    const day = Number(d.date.slice(8, 10));
    const label = isMultiMonth
      ? `${MONTH_SHORT[Number(d.date.slice(5, 7)) - 1]} ${day}`
      : String(day);
    return { label, value: d[key] };
  });
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ----------------------------------------------------------------- overview */

function OverviewReport({ a, label }: { a: ReportsAnalytics; label: string }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Income" value={a.current.income} tone="income" delta={a.deltas.income} deltaGood="up" />
        <StatCard label="Expenses" value={a.current.effectiveExpense} tone="expense" delta={a.deltas.expense} deltaGood="down" />
        <StatCard label="Net" value={a.current.net} tone={a.current.net >= 0 ? "income" : "expense"} delta={a.deltas.net} deltaGood="up" />
        <Tile label="Savings rate" hint="of income saved">
          {formatPercent(a.current.savingsRate)}
        </Tile>
      </div>

      <Card>
        <CardHeader title="Income vs expenses" subtitle="Last 6 months" />
        <CardBody className="pt-2">
          <IncomeExpenseBars data={a.incomeExpenseTrend} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Daily spending" subtitle={label} />
        <CardBody className="pt-2">
          {a.transactionCount === 0 ? (
            <EmptyState title="No activity this period" description="Charts appear once you record transactions." />
          ) : (
            <TrendArea data={dailySeries(a, "expense")} name="Spent" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------- category */

function CategoryReport({ a, title }: { a: ReportsAnalytics; title: string }) {
  const rows = a.categories;
  const totalSpend = useMemo(() => rows.reduce((s, c) => s + c.net, 0), [rows]);
  const donutData = rows.map((c) => ({ name: c.name, value: c.net, color: c.color }));

  if (rows.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="No spending recorded" description="Category breakdowns appear once you record expenses." />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <DistributionTiles values={rows.map((c) => c.net)} unit="category" />

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title={title} subtitle="Effective spend" />
          <CardBody>
            <div className="relative">
              <CategoryDonut data={donutData} height={220} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xs text-muted">Total spent</span>
                <Money paise={totalSpend} tone="default" className="text-base font-semibold" compact />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="min-w-0 lg:col-span-3">
          <CardHeader title="Breakdown" subtitle={`${rows.length} categories`} />
          <CardBody className="px-0 py-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-5 py-2.5 font-medium">Category</th>
                    <th className="px-3 py-2.5 text-right font-medium">Txns</th>
                    <th className="px-3 py-2.5 text-right font-medium">% of spend</th>
                    <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((c) => (
                    <tr key={c.categoryId ?? "none"}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-none" style={{ backgroundColor: c.color }} />
                          <Icon name={c.icon} size={15} className="text-muted" />
                          <span className="truncate text-fg">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{c.count}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                        {totalSpend > 0 ? formatPercent((c.net / totalSpend) * 100) : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Money paise={c.net} tone="default" className="font-medium" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-medium">
                    <td className="px-5 py-2.5 text-fg">Total</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {rows.reduce((s, c) => s + c.count, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">100%</td>
                    <td className="px-5 py-2.5 text-right">
                      <Money paise={totalSpend} tone="default" className="font-semibold" />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ account */

function AccountReport({ perAccount }: { perAccount: PerAccountRow[] }) {
  const { accounts } = useAppData();
  const active = accounts.filter((acc) => !acc.isArchived);
  const spendById = new Map(perAccount.map((p) => [p.accountId, p]));
  const totalBalance = active.reduce((s, acc) => s + acc.balance, 0);

  if (active.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="No accounts yet" description="Add an account to see balances here." />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Total balance">
          <Money paise={totalBalance} tone={totalBalance >= 0 ? "default" : "expense"} />
        </Tile>
        <Tile label="Accounts" hint="active">
          <span className="tabular-nums">{active.length}</span>
        </Tile>
      </div>

      <Card>
        <CardHeader title="Accounts" subtitle="Balances and period activity" />
        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-5 py-2.5 font-medium">Account</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Spent</th>
                  <th className="px-3 py-2.5 text-right font-medium">Txns</th>
                  <th className="px-5 py-2.5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {active.map((acc) => {
                  const p = spendById.get(acc.id);
                  return (
                    <tr key={acc.id}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-none" style={{ backgroundColor: acc.color }} />
                          <Icon name={acc.icon} size={15} className="text-muted" />
                          <span className="truncate text-fg">{acc.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted">{formatAccountType(acc.type)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Money paise={Math.max(0, p?.expense ?? 0)} tone={p && p.expense > 0 ? "expense" : "muted"} />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{p?.count ?? 0}</td>
                      <td className="px-5 py-2.5 text-right">
                        <Money paise={acc.balance} tone={acc.balance >= 0 ? "default" : "expense"} className="font-medium" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td className="px-5 py-2.5 text-fg" colSpan={4}>
                    Total balance
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Money paise={totalBalance} tone="default" className="font-semibold" />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- income */

function IncomeReport({ a }: { a: ReportsAnalytics }) {
  const incomeTrend = a.incomeExpenseTrend.map((m) => ({ label: m.label, value: m.income }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Income this month" value={a.current.income} tone="income" delta={a.deltas.income} deltaGood="up" />
        <StatCard label="Net" value={a.current.net} tone={a.current.net >= 0 ? "income" : "expense"} delta={a.deltas.net} deltaGood="up" />
        <Tile label="Savings rate" hint="of income saved">
          {formatPercent(a.current.savingsRate)}
        </Tile>
        <Tile label="Transactions" hint="this month">
          <span className="tabular-nums">{a.transactionCount}</span>
        </Tile>
      </div>

      <Card>
        <CardHeader title="Income trend" subtitle="Last 6 months" />
        <CardBody className="pt-2">
          <TrendArea data={incomeTrend} name="Income" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Monthly income" subtitle="Last 6 months" />
        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-5 py-2.5 font-medium">Month</th>
                  <th className="px-5 py-2.5 text-right font-medium">Income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {a.incomeExpenseTrend.map((m) => (
                  <tr key={m.label}>
                    <td className="px-5 py-2.5 text-fg">{m.label}</td>
                    <td className="px-5 py-2.5 text-right">
                      <Money paise={m.income} tone="income" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <DistributionTiles values={a.incomeExpenseTrend.map((m) => m.income)} unit="month" />
    </div>
  );
}

/* ----------------------------------------------------------------- expenses */

function ExpenseReport({ a }: { a: ReportsAnalytics }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Expenses this month" value={a.current.effectiveExpense} tone="expense" delta={a.deltas.expense} deltaGood="down" />
        <Tile label="Avg daily spend">
          <Money paise={a.avgDailySpend} tone="default" />
        </Tile>
        <Tile label="Subscriptions">
          <Money paise={a.subscriptionSpend} tone="default" />
        </Tile>
        <Tile label="Largest expense" hint={a.largestExpense?.description}>
          {a.largestExpense ? <Money paise={a.largestExpense.amount} tone="expense" /> : "—"}
        </Tile>
      </div>

      <Card>
        <CardHeader title="Daily spending" subtitle="This month" />
        <CardBody className="pt-2">
          {a.transactionCount === 0 ? (
            <EmptyState title="No spending this period" description="Charts appear once you record expenses." />
          ) : (
            <TrendArea data={dailySeries(a, "expense")} name="Spent" />
          )}
        </CardBody>
      </Card>

      <CategoryReport a={a} title="Expenses by category" />
    </div>
  );
}

/* ---------------------------------------------------------------- cash flow */

function CashFlowReport({ a }: { a: ReportsAnalytics }) {
  const nets = a.incomeExpenseTrend.map((m) => m.income - m.expense);
  return (
    <div className="space-y-5">
      <DistributionTiles values={nets} unit="month" />

      <Card>
        <CardHeader title="Income vs expenses" subtitle="Last 6 months" />
        <CardBody className="pt-2">
          <IncomeExpenseBars data={a.incomeExpenseTrend} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Cash flow" subtitle="Income, expenses and net by month" />
        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-5 py-2.5 font-medium">Month</th>
                  <th className="px-3 py-2.5 text-right font-medium">Income</th>
                  <th className="px-3 py-2.5 text-right font-medium">Expenses</th>
                  <th className="px-5 py-2.5 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {a.incomeExpenseTrend.map((m) => {
                  const net = m.income - m.expense;
                  return (
                    <tr key={m.label}>
                      <td className="px-5 py-2.5 text-fg">{m.label}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Money paise={m.income} tone="income" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Money paise={m.expense} tone="expense" />
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Money paise={net} tone={net >= 0 ? "income" : "expense"} className="font-medium" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
