"use client";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

/**
 * Buttons are the system's expressive component: square, compact, ink-bordered,
 * and stamped with a hard offset shadow. The stamp is now tactile: it lifts on
 * hover (shadow grows, element shifts up-left) and presses on click (element
 * seats exactly into where its shadow was, shadow collapses).
 */
// Shared "stamped, pressable" interaction for shadowed variants.
const PRESS =
  "hover:-translate-x-px hover:-translate-y-px hover:shadow-stamp-lg active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

const VARIANTS: Record<Variant, string> = {
  primary: `bg-brand text-brand-fg border border-border shadow-stamp hover:bg-brand-hover ${PRESS}`,
  secondary: `bg-tertiary text-secondary border border-border shadow-stamp hover:bg-brand-soft ${PRESS}`,
  // Outline has no resting shadow, but earns a light one on hover so it joins
  // the same tactile language instead of feeling inert.
  outline:
    "bg-transparent text-fg border border-border hover:bg-surface-2 hover:shadow-stamp-sm hover:-translate-x-px hover:-translate-y-px active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  ghost: "bg-transparent text-muted hover:text-fg hover:underline underline-offset-4 decoration-2",
  danger: `bg-expense text-tertiary border border-border shadow-stamp hover:bg-expense/85 ${PRESS}`,
};

// Square geometry, 41px default height, 13px/20px padding — per the spec.
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-label-md uppercase gap-1.5 rounded-none",
  md: "h-[41px] px-5 text-body-sm gap-2 rounded-none",
  lg: "h-12 px-6 text-body-md font-bold gap-2 rounded-none",
  icon: "h-[34px] w-[34px] rounded-none",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-bold transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
