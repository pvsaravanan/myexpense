import { requireUserOrRedirect } from "@/lib/auth";
import { getMonthlyAnalytics, getRangeAnalytics } from "@/lib/analytics";
import { loadCalcTxns } from "@/lib/queries";
import { filterRange } from "@/lib/calculations";
import {
  monthKeyOf,
  monthLabel,
  monthRange,
  monthStart,
  monthEndExclusive,
  addMonths as addMonthKey,
  parseMonthKey,
  toISODate,
  formatDate,
  type MonthKey,
} from "@/lib/dates";
import { PageHeader } from "@/components/app/page-header";
import { PeriodNav, type Period } from "@/components/app/period-nav";
import { ReportsView, type PerAccountRow, type ReportsAnalytics } from "@/components/app/reports-view";

export const metadata = { title: "Reports · baaki" };

const VALID_PERIODS = new Set<string>(["1m", "3m", "6m", "1y"]);
const PERIOD_MONTHS: Record<string, number> = { "3m": 3, "6m": 6, "1y": 12 };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; period?: string }>;
}) {
  const user = await requireUserOrRedirect();
  const { m, period: rawPeriod } = await searchParams;
  const period: Period = VALID_PERIODS.has(rawPeriod ?? "") ? (rawPeriod as Period) : "1m";
  const nowKey = monthKeyOf(new Date());
  const monthKey: MonthKey = parseMonthKey(m) ?? nowKey;
  const isCurrent = monthKey.year === nowKey.year && monthKey.month === nowKey.month;

  const txns = await loadCalcTxns(user.id);

  let analytics;
  let rangeStart: Date;
  let rangeEnd: Date;
  let label: string;

  if (period === "1m") {
    // Single month: existing behavior
    analytics = await getMonthlyAnalytics(user.id, monthKey, txns);
    const r = monthRange(monthKey);
    rangeStart = r.start;
    rangeEnd = r.end;
    label = monthLabel(monthKey);
  } else {
    // Multi-month range: N months ending at end of current month
    const months = PERIOD_MONTHS[period];
    const startKey = addMonthKey(nowKey, -(months - 1));
    rangeStart = monthStart(startKey);
    rangeEnd = monthEndExclusive(nowKey);

    // Previous equivalent period for comparison
    const prevStartKey = addMonthKey(startKey, -months);
    const prevEndKey = addMonthKey(startKey, -1);
    const prevStart = monthStart(prevStartKey);
    const prevEnd = monthEndExclusive(prevEndKey);

    analytics = await getRangeAnalytics(user.id, rangeStart, rangeEnd, prevStart, prevEnd, txns);
    label = `${formatDate(rangeStart, { withYear: true })} – ${formatDate(new Date(rangeEnd.getTime() - 1), { withYear: true })}`;
  }

  // Per-account activity for the selected range.
  const rangeTxns = filterRange(txns, rangeStart, rangeEnd);
  const byAccount = new Map<string, PerAccountRow>();
  for (const t of rangeTxns) {
    const row = byAccount.get(t.accountId) ?? { accountId: t.accountId, expense: 0, income: 0, count: 0 };
    row.count += 1;
    if (t.type === "expense") row.expense += t.amount;
    else if (t.type === "refund") row.expense -= t.amount;
    else if (t.type === "income") row.income += t.amount;
    byAccount.set(t.accountId, row);
  }
  const perAccount = [...byAccount.values()];

  // Serialize Dates for the client component.
  const serialized: ReportsAnalytics = {
    ...analytics,
    largestExpense: analytics.largestExpense
      ? { ...analytics.largestExpense, date: toISODate(analytics.largestExpense.date) }
      : null,
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Financial breakdown for ${label}.`}
        actions={
          <PeriodNav
            period={period}
            monthKey={monthKey}
            isCurrent={isCurrent}
            className="w-full sm:w-auto"
          />
        }
      />
      <ReportsView analytics={serialized} monthLabel={label} perAccount={perAccount} />
    </div>
  );
}
