import { formatINR } from "@/lib/money";
import { daysInMonth, monthName, type MonthKey } from "@/lib/dates";
import { cn } from "@/lib/cn";

/**
 * Calendar heatmap of daily spending. Intensity scales with each day's
 * effective expense relative to the busiest day in the month.
 */
export function SpendingCalendar({
  monthKey,
  daily,
}: {
  monthKey: MonthKey;
  daily: { date: string; expense: number }[];
}) {
  const spendByDay = new Map(daily.map((d) => [Number(d.date.slice(-2)), d.expense]));
  const max = Math.max(1, ...daily.map((d) => d.expense));
  const total = daily.length;
  const first = new Date(monthKey.year, monthKey.month - 1, 1).getDay(); // 0=Sun
  const count = daysInMonth(monthKey);
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-label-sm uppercase text-faint">
        {weekdays.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: first }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: count }).map((_, i) => {
          const day = i + 1;
          const spend = spendByDay.get(day) ?? 0;
          const intensity = spend > 0 ? 0.14 + (spend / max) * 0.86 : 0;
          return (
            <div
              key={day}
              title={`${day} ${monthName(monthKey.month, true)} — ${spend > 0 ? formatINR(spend) : "No spending"}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-none border border-border-faint text-label-sm tabular-nums",
                spend > 0 ? "text-fg" : "text-faint",
              )}
              // Coral wash scales with spend — pixel-grid intensity, no blur.
              style={spend > 0 ? { backgroundColor: `hsl(var(--brand) / ${intensity})` } : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>
      <p className="mt-md flex items-center justify-end gap-1 text-label-sm uppercase text-faint">
        Less
        {[0.15, 0.4, 0.65, 0.9].map((o) => (
          <span
            key={o}
            className="h-3 w-3 border border-border-faint"
            style={{ backgroundColor: `hsl(var(--brand) / ${o})` }}
          />
        ))}
        More
      </p>
    </div>
  );
}
