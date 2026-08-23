import { cn } from "@/lib/cn";
import { formatINR, formatINRCompact } from "@/lib/money";

/**
 * Renders a money amount (paise) with tabular figures and optional semantic
 * coloring. This is the signature numeric treatment used across the app.
 */
export function Money({
  paise,
  tone = "auto",
  sign = false,
  compact = false,
  decimals = "auto",
  className,
}: {
  paise: number;
  tone?: "auto" | "income" | "expense" | "muted" | "default";
  sign?: boolean;
  compact?: boolean;
  decimals?: "auto" | "always" | "never";
  className?: string;
}) {
  const text = compact
    ? formatINRCompact(paise)
    : formatINR(paise, { showSign: sign, decimals });

  let color = "";
  if (tone === "income") color = "text-income";
  else if (tone === "expense") color = "text-expense";
  else if (tone === "muted") color = "text-muted";
  else if (tone === "auto") color = paise > 0 ? "text-income" : paise < 0 ? "text-expense" : "text-fg";

  return <span className={cn("tnum tabular-nums", color, className)}>{text}</span>;
}
