import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { requireUserOrRedirect } from "@/lib/auth";
import { getMonthlyAnalytics } from "@/lib/analytics";
import { loadGoals, loadPreference, loadRecurring, loadTransactions } from "@/lib/queries";
import { monthKeyOf, monthKeyString, parseMonthKey, fromISODate, formatDate, type MonthKey } from "@/lib/dates";
import { monthlyContributionNeeded } from "@/lib/calculations";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Money } from "@/components/money";
import { Progress, Badge, EmptyState } from "@/components/ui/misc";
import { Icon } from "@/components/icon";
import { StatCard } from "@/components/app/stat-card";
import { PageHeader } from "@/components/app/page-header";
import { MonthNav } from "@/components/app/month-nav";
import { SpendingCalendar } from "@/components/app/spending-calendar";
import { TransactionRow } from "@/components/app/transaction-row";
import { CategoryDonut } from "@/components/charts/chart-kit";
import { IncomeExpenseCard } from "@/components/app/income-expense-card";
import { formatINR, formatPercent } from "@/lib/money";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUserOrRedirect();
  const { m } = await searchParams;
  const nowKey = monthKeyOf(new Date());
  const monthKey: MonthKey = parseMonthKey(m) ?? nowKey;
  const isCurrent = monthKey.year === nowKey.year && monthKey.month === nowKey.month;

  const [a, pref, recent, recurring, goals] = await Promise.all([
    getMonthlyAnalytics(user.id, monthKey),
    loadPreference(user.id),
    loadTransactions(user.id, { take: 6 }),
    loadRecurring(user.id),
    loadGoals(user.id),
  ]);
  const on = (key: string) => pref.dashboardWidgets.includes(key);

  const budgetLimit = a.budget.overallLimit ?? a.budget.lines.reduce((s, l) => s + l.limit, 0);
  const budgetRemaining = budgetLimit - a.budget.overallSpent;

  // Upcoming recurring within ~45 days.
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 45);
  const upcoming = recurring
    .filter((r) => r.isActive)
    .map((r) => ({ r, date: fromISODate(r.nextOccurrence)! }))
    .filter((x) => x.date <= horizon)
    .sort((x, y) => x.date.getTime() - y.date.getTime())
    .slice(0, 5);

  const donutData = a.categories.slice(0, 8).map((c) => ({ name: c.name, value: c.net, color: c.color }));
  const activeGoals = goals.filter((g) => g.status !== "archived").slice(0, 3);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Here's where your money went this month."
        actions={<MonthNav monthKey={monthKey} isCurrent={isCurrent} className="w-full sm:w-auto" />}
      />

      {/* Core stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Balance" value={a.totalBalance} tone="default" hint="across all accounts" />
        <StatCard label="Income" value={a.current.income} tone="income" delta={a.deltas.income} deltaGood="up" />
        <StatCard label="Expenses" value={a.current.effectiveExpense} tone="expense" delta={a.deltas.expense} deltaGood="down" />
        <StatCard label="Net savings" value={a.current.net} tone={a.current.net >= 0 ? "income" : "expense"} delta={a.deltas.net} deltaGood="up" />
        <SavingsRateCard rate={a.current.savingsRate} delta={a.deltas.savings} />
        <BudgetRemainingCard remaining={budgetRemaining} limit={budgetLimit} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left / main column */}
        <div className="space-y-5 lg:col-span-2">
          {on("monthly_spending") && <IncomeExpenseCard trend={a.incomeExpenseTrend} />}

          <Card>
            <CardHeader
              title="Spending calendar"
              subtitle="Daily spending intensity"
              action={<span className="text-label-sm uppercase text-muted">{a.transactionCount} txns</span>}
            />
            <CardBody className="pt-2">
              <SpendingCalendar monthKey={monthKey} daily={a.daily} />
            </CardBody>
          </Card>

          {on("recent_transactions") && (
            <Card>
              <CardHeader title="Recent transactions" action={<Link href="/transactions" className="text-label-sm uppercase text-brand-hover underline-offset-4 hover:underline">View all</Link>} />
              <CardBody className="px-3 py-2">
                {recent.length === 0 ? (
                  <EmptyState title="No transactions yet" description="Add your first transaction to get started." />
                ) : (
                  <div className="divide-y divide-border">
                    {recent.map((t) => (
                      <TransactionRow key={t.id} txn={t} />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {on("spending_categories") && (
            <Card>
              <CardHeader title="Spending by category" action={<Link href="/reports" className="text-label-sm uppercase text-brand-hover underline-offset-4 hover:underline">Report</Link>} />
              <CardBody>
                {donutData.length === 0 ? (
                  <EmptyState title="No spending yet" description="Categories appear as you spend." />
                ) : (
                  <>
                    <div className="relative">
                      <CategoryDonut data={donutData} height={200} />
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-label-sm uppercase text-muted">Spent</span>
                        <Money paise={a.current.effectiveExpense} tone="default" className="text-base font-semibold" compact />
                      </div>
                    </div>
                    {/* Shared grid: percentage + amount columns size to the
                        widest value across ALL rows, so they stay in straight
                        lines regardless of amount magnitude. */}
                    <ul className="mt-3 grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 gap-y-2 text-sm">
                      {a.categories.slice(0, 5).map((c) => (
                        <li key={c.categoryId ?? "none"} className="col-span-full grid grid-cols-subgrid items-center">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-none" style={{ backgroundColor: c.color }} />
                          <span className="min-w-0 truncate text-fg">{c.name}</span>
                          <span className="justify-self-end tabular-nums text-muted">
                            {a.current.effectiveExpense > 0 ? formatPercent((c.net / a.current.effectiveExpense) * 100, 0) : "0%"}
                          </span>
                          <Money paise={c.net} tone="default" className="justify-self-end text-sm font-medium" />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardBody>
            </Card>
          )}

          {on("budget") && (
            <Card>
              <CardHeader title="Budget" subtitle={budgetLimit > 0 ? `${formatINR(a.budget.overallSpent)} of ${formatINR(budgetLimit)}` : undefined} action={<Link href="/budgets" className="text-label-sm uppercase text-brand-hover underline-offset-4 hover:underline">Manage</Link>} />
              <CardBody>
                {budgetLimit === 0 ? (
                  <EmptyState title="No budget set" description="Set monthly limits to track spending." action={<Link href="/budgets" className="text-sm font-medium text-brand-hover hover:underline">Set a budget</Link>} />
                ) : (
                  <div className="space-y-3">
                    <Progress value={budgetLimit > 0 ? (a.budget.overallSpent / budgetLimit) * 100 : 0} tone={budgetRemaining < 0 ? "expense" : (a.budget.overallSpent / budgetLimit) >= 0.9 ? "warning" : "brand"} />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">{budgetRemaining >= 0 ? "Remaining" : "Over budget"}</span>
                      <Money paise={Math.abs(budgetRemaining)} tone={budgetRemaining >= 0 ? "income" : "expense"} className="font-semibold" />
                    </div>
                    {a.budget.lines.filter((l) => l.status.state !== "under").slice(0, 3).map((l) => (
                      <div key={l.categoryId} className="flex items-center gap-2 text-xs">
                        <Icon name={l.icon} size={13} className="text-muted" />
                        <span className="text-fg">{l.name}</span>
                        <Badge tone={l.status.state === "over" ? "expense" : "warning"} className="ml-auto">
                          {l.status.state === "over" ? "Over" : "Near limit"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {on("upcoming_recurring") && (
            <Card>
              <CardHeader title="Upcoming payments" action={<Link href="/recurring" className="text-label-sm uppercase text-brand-hover underline-offset-4 hover:underline">All</Link>} />
              <CardBody className="space-y-2">
                {upcoming.length === 0 ? (
                  <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="Nothing scheduled" description="Add recurring payments to see them here." />
                ) : (
                  upcoming.map(({ r, date }) => (
                    <div key={r.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-none bg-surface-2 text-muted">
                        <CalendarClock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{r.name}</p>
                        <p className="text-xs text-muted">{formatDate(date, { withYear: false })}</p>
                      </div>
                      <Money paise={r.type === "income" ? r.amount : -r.amount} tone={r.type === "income" ? "income" : "expense"} className="text-sm font-medium" />
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          )}

          {on("financial_goals") && activeGoals.length > 0 && (
            <Card>
              <CardHeader title="Goals" action={<Link href="/goals" className="text-label-sm uppercase text-brand-hover underline-offset-4 hover:underline">All</Link>} />
              <CardBody className="space-y-4">
                {activeGoals.map((g) => {
                  const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
                  return (
                    <div key={g.id}>
                      <div className="mb-1 flex items-center gap-2 text-sm">
                        <Icon name={g.icon} size={15} className="text-brand-hover" />
                        <span className="truncate font-medium text-fg">{g.name}</span>
                        <span className="ml-auto text-xs text-muted">{formatPercent(pct, 0)}</span>
                      </div>
                      <Progress value={pct} />
                      <div className="mt-1 flex justify-between text-2xs text-muted">
                        <Money paise={g.currentAmount} tone="default" compact />
                        <Money paise={g.targetAmount} tone="muted" compact />
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}

          {on("insights") && a.insights.length > 0 && (
            <Card>
              <CardHeader title="Insights" action={<Link href="/insights" className="text-label-sm uppercase text-brand-hover underline-offset-4 hover:underline">More</Link>} />
              <CardBody className="space-y-2.5">
                {a.insights.slice(0, 4).map((ins) => (
                  <div key={ins.id} className="flex gap-2.5 text-sm">
                    <Icon name={ins.icon} size={16} className={insightColor(ins.tone)} />
                    <p className="text-fg">{ins.text}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SavingsRateCard({ rate, delta }: { rate: number; delta: number | null }) {
  return (
    <div className="rounded-none border border-border bg-surface p-sm [container-type:inline-size]">
      <p className="text-label-sm uppercase text-muted">Savings rate</p>
      <p className="mt-2 whitespace-nowrap font-bold tabular-nums tracking-tight text-fg text-[clamp(1rem,10.5cqi,1.55rem)]">
        {formatPercent(rate)}
      </p>
      <p className="mt-1.5 text-label-sm uppercase text-faint">of income saved</p>
    </div>
  );
}

function BudgetRemainingCard({ remaining, limit }: { remaining: number; limit: number }) {
  return (
    <div className="rounded-none border border-border bg-surface p-sm [container-type:inline-size]">
      <p className="text-label-sm uppercase text-muted">Budget left</p>
      <div className="mt-2">
        {limit > 0 ? (
          <Money
            paise={remaining}
            tone={remaining >= 0 ? "income" : "expense"}
            className="whitespace-nowrap font-bold tracking-tight text-[clamp(1rem,10.5cqi,1.55rem)]"
          />
        ) : (
          <span className="font-bold text-faint text-[clamp(1rem,10.5cqi,1.55rem)]">—</span>
        )}
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-label-sm uppercase text-faint">
        {limit > 0 ? `of ${formatINR(limit)}` : "no budget set"}
        <Link href="/budgets" className="text-brand-hover hover:underline">
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function insightColor(tone: string) {
  return tone === "warning" ? "text-warning" : tone === "positive" ? "text-income" : tone === "info" ? "text-brand-hover" : "text-muted";
}
