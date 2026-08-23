import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "income" | "expense" | "warning";
  className?: string;
}) {
  // Chips are tiny, square, uppercase markers — institutional system cues.
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-secondary border-border",
    brand: "bg-brand text-brand-fg border-border",
    income: "bg-income/15 text-income border-income/40",
    expense: "bg-expense/15 text-expense border-expense/40",
    warning: "bg-warning/15 text-warning border-warning/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-none border px-2 py-0.5 text-label-sm uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Progress({
  value,
  tone = "brand",
  className,
}: {
  value: number; // 0-100+
  tone?: "brand" | "income" | "expense" | "warning";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(value, 100));
  const tones: Record<string, string> = {
    brand: "bg-brand",
    income: "bg-income",
    expense: "bg-expense",
    warning: "bg-warning",
  };
  // Square meter with an ink outline — a printed gauge, not a soft pill.
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-none border border-border bg-surface-2", className)}>
      <div
        className={cn("h-full rounded-none transition-all", tones[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-muted", className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-none border border-border bg-surface-2 text-muted">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-none bg-surface-2", className)} />;
}
