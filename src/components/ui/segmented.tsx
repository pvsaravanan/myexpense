"use client";
import { cn } from "@/lib/cn";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full items-center overflow-x-auto rounded-none border border-border bg-surface no-scrollbar",
        className,
      )}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            // Roving tabindex + arrow keys, per the tablist ARIA contract the
            // role="tab" markup implies.
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const delta = e.key === "ArrowRight" ? 1 : -1;
              const nextIndex = (i + delta + options.length) % options.length;
              onChange(options[nextIndex].value);
            }}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none uppercase transition-colors min-h-[38px] touch-manipulation",
              i > 0 && "border-l border-border",
              size === "sm" ? "px-2.5 py-1.5 text-label-sm" : "px-3.5 py-2 text-label-md",
              active ? "bg-brand text-brand-fg font-semibold" : "text-muted hover:bg-brand-soft hover:text-secondary",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
