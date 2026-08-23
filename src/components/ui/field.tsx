"use client";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-label-md uppercase text-muted">
          {label}
          {required && <span className="ml-0.5 text-expense">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-expense">{error}</p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

// Flat, square, utilitarian — the same language as cards. 13px/16px padding.
// 16px minimum text size on mobile prevents iOS Safari auto-zooming the viewport on focus.
const base =
  "w-full rounded-none border bg-surface px-4 py-3 text-[16px] sm:text-body-md text-fg placeholder:text-faint transition-colors focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(base, invalid ? "border-expense focus:border-expense" : "border-border focus:border-brand", className)}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-none border bg-surface px-4 py-3 text-[16px] sm:text-body-md text-fg placeholder:text-faint transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60",
        "min-h-[80px] resize-y",
        invalid ? "border-expense" : "border-border focus:border-brand",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        base,
        "cursor-pointer appearance-none bg-[right_0.9rem_center] bg-no-repeat pr-10",
        invalid ? "border-expense" : "border-border focus:border-brand",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundSize: "1rem",
      }}
      {...props}
    >
      {children}
    </select>
  );
});
