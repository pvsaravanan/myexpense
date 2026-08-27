import { requireUserOrRedirect } from "@/lib/auth";
import { getMonthlyAnalytics } from "@/lib/analytics";
import { monthKeyOf } from "@/lib/dates";
import { formatPercent } from "@/lib/money";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Money } from "@/components/money";
import { Icon } from "@/components/icon";
import type { InsightTone } from "@/lib/insights";

export const metadata = { title: "Insights · Baaki" };

export default async function InsightsPage() {
  const user = await requireUserOrRedirect();
  const a = await getMonthlyAnalytics(user.id, monthKeyOf(new Date()));

  return (
    <div>
      <PageHeader title="Insights" description="What your numbers are telling you." />

      {/* Key computed facts */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Avg daily spend">
          <Money paise={a.avgDailySpend} tone="default" />
        </Tile>
        <Tile label="Top category" hint={a.topCategory ? undefined : "no spending yet"}>
          {a.topCategory ? (
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-base font-semibold text-fg">{a.topCategory.name}</span>
              <Money paise={a.topCategory.net} tone="default" className="text-base" compact />
            </span>
          ) : (
            <span className="text-faint">—</span>
          )}
        </Tile>
        <Tile label="Subscriptions" hint="this month">
          <Money paise={a.subscriptionSpend} tone="default" />
        </Tile>
        <Tile label="Savings rate" hint="of income saved">
          {formatPercent(a.current.savingsRate)}
        </Tile>
      </div>

      {a.insights.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Icon name="pie-chart" size={20} />}
              title="No insights yet"
              description="Insights appear automatically as you record income and expenses this month."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {a.insights.map((ins) => {
            const t = toneClasses(ins.tone);
            return (
              <div key={ins.id} className="flex items-start gap-3 rounded-none border border-border bg-surface p-4 shadow-card">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none">
                  <Icon name={ins.icon} size={22} className={t.text} />
                </div>
                <p className="pt-1 text-sm text-fg">{ins.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

function toneClasses(tone: InsightTone): { text: string; bg: string } {
  switch (tone) {
    case "warning":
      return { text: "text-warning", bg: "bg-warning/10" };
    case "positive":
      return { text: "text-income", bg: "bg-income/10" };
    case "info":
      return { text: "text-brand-hover", bg: "bg-brand-soft" };
    default:
      return { text: "text-muted", bg: "bg-surface-2" };
  }
}
