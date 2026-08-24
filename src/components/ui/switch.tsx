"use client";
import { cn } from "@/lib/cn";

/**
 * Stamped-style toggle. The track is a bordered slot; the knob is a small tile
 * with a hard offset shadow that slides between the two ends — reading as a
 * physical switch rather than a floating dot.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-none border border-border px-0.5 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand" : "bg-surface-2",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-none border border-border bg-surface shadow-stamp-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0",
        )}
      />
    </button>
  );
}
