"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, monthKeyString, monthLabel, type MonthKey } from "@/lib/dates";
import { cn } from "@/lib/cn";

/** Prev / current / next month navigator that drives the `?m=YYYY-MM` param. */
export function MonthNav({ monthKey, isCurrent, className }: { monthKey: MonthKey; isCurrent: boolean; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (key: MonthKey) => {
    const next = new URLSearchParams(params);
    next.set("m", monthKeyString(key));
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className={cn("inline-flex items-center justify-between gap-1 rounded-none border border-border bg-surface p-1", className)}>
      <button
        onClick={() => go(addMonths(monthKey, -1))}
        className="flex h-9 w-9 items-center justify-center rounded-none p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg active:bg-surface-2"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[120px] px-2 text-center text-sm font-medium text-fg">{monthLabel(monthKey)}</span>
      <button
        onClick={() => go(addMonths(monthKey, 1))}
        disabled={isCurrent}
        className="flex h-9 w-9 items-center justify-center rounded-none p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent active:bg-surface-2"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
