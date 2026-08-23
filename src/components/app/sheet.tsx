"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Lightweight bottom sheet for mobile menus. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const FOCUSABLE =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Trap Tab within the sheet so keyboard users can't reach the covered
      // page behind it.
      if (e.key === "Tab") {
        const els = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
          (el) => el.offsetParent !== null || el === document.activeElement,
        );
        if (els.length === 0) {
          e.preventDefault();
          return;
        }
        const first = els[0];
        const last = els[els.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-overlay/60 animate-fade-in" onClick={onClose} aria-hidden />
      <div ref={panelRef} className="relative z-10 w-full rounded-none border-t-2 border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-sheet animate-sheet-up">
        <div className="mx-auto mb-3 h-1 w-10 rounded-none bg-border-strong" />
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fg">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-fg">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
