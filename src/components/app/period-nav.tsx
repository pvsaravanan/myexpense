"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, monthKeyString, monthLabel, type MonthKey } from "@/lib/dates";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export type Period = "1m" | "3m" | "6m" | "1y";

const PERIOD_LABELS: Record<Period, string> = {
  "1m": "This month",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  "1y": "Last year",
};

export function PeriodNav({
  period,
  monthKey,
  isCurrent,
  className,
}: {
  period: Period;
  monthKey: MonthKey;
  isCurrent: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (patch: { m?: string; period?: string }) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // Clean up defaults: period=1m is the default, no need to keep in URL
    if (next.get("period") === "1m") next.delete("period");
    router.push(`${pathname}?${next.toString()}`);
  };

  const goMonth = (key: MonthKey) => go({ m: monthKeyString(key) });

  const handlePeriodChange = (value: string) => {
    const p = value as Period;
    if (p === "1m") {
      // Switch to single-month mode, keep current month
      go({ period: "1m" });
    } else {
      // Multi-month: remove month param, set period
      const next = new URLSearchParams(params);
      next.delete("m");
      next.set("period", p);
      router.push(`${pathname}?${next.toString()}`);
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Select
        value={period}
        onChange={(e) => handlePeriodChange(e.target.value)}
        className="min-w-[150px] text-sm"
      >
        {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </Select>

      {/* Month arrows only in single-month mode */}
      {period === "1m" && (
        <div className="inline-flex items-center gap-1 rounded-none border border-border bg-surface p-1">
          <button
            onClick={() => goMonth(addMonths(monthKey, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-none p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg active:bg-surface-2"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] px-2 text-center text-sm font-medium text-fg">
            {monthLabel(monthKey)}
          </span>
          <button
            onClick={() => goMonth(addMonths(monthKey, 1))}
            disabled={isCurrent}
            className="flex h-9 w-9 items-center justify-center rounded-none p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent active:bg-surface-2"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
