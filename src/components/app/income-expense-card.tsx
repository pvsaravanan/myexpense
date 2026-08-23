"use client";
import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { IncomeExpenseBars } from "@/components/charts/chart-kit";

type Range = "1m" | "3m" | "6m" | "1y";

const OPTIONS: { value: Range; label: string }[] = [
  { value: "1m", label: "This month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last 12 months" },
];
const MONTHS: Record<Range, number> = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 };

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

type Point = { label: string; month: number; year: number; income: number; expense: number };

/**
 * Income vs expenses chart with a timeline dropdown. The server provides up to
 * 12 months of trend; changing the range just slices it client-side.
 */
export function IncomeExpenseCard({ trend }: { trend: Point[] }) {
  const [range, setRange] = useState<Range>("6m");
  const sliced = trend.slice(-MONTHS[range]);
  // Anchor the axis with a year: at every January (a real year boundary) and,
  // on the 1Y view, at the first bar so the starting year is clear too.
  const data = sliced.map((p, i) => ({
    ...p,
    label: p.month === 1 || (range === "1y" && i === 0) ? `${p.label} '${String(p.year).slice(-2)}` : p.label,
  }));

  return (
    <Card>
      <CardHeader
        title="Income vs expenses"
        action={
          <select
            aria-label="Timeline"
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            className="cursor-pointer appearance-none rounded-none border border-border bg-surface bg-[right_0.6rem_center] bg-no-repeat py-1.5 pl-3 pr-9 text-label-md uppercase text-fg transition-colors hover:bg-surface-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring/25"
            style={{ backgroundImage: CHEVRON, backgroundSize: "0.85rem" }}
          >
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        }
      />
      <CardBody className="pt-2">
        <IncomeExpenseBars data={data} />
      </CardBody>
    </Card>
  );
}
