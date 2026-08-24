"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Responsive dialog: a bottom sheet on small screens (comfortable one-handed
 * use) and a centered modal on md+. Closes on Escape and overlay click.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /**
   * True while a save/delete triggered from inside this modal is in flight.
   * Suppresses Escape, backdrop click, and the X button so the request can't
   * be silently abandoned mid-flight — closing while busy previously let the
   * mutation complete anyway after the user believed they'd cancelled.
   */
  busy?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const FOCUSABLE =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onClose();
        return;
      }
      // Focus trap: keep Tab within the dialog so keyboard users can't reach
      // the (visually covered, still-live) page behind the modal.
      if (e.key === "Tab") {
        const els = focusable();
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
    // Lock background scroll. iOS Safari ignores `overflow: hidden` on <body>
    // for touch, so the page (and this fixed overlay) rubber-bands under a
    // finger drag. Pinning the body with `position: fixed` at the current
    // scroll offset is the reliable cross-browser lock; we restore it — and the
    // scroll position — on close.
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    // Focus the first field inside the content, NOT the header's close (X)
    // button — otherwise pressing Enter right after opening closes the dialog.
    // For dialogs whose content has no field (e.g. confirm prompts, whose
    // buttons live in the footer), fall back to the first focusable in the
    // panel that ISN'T the Close button, so Enter lands on Cancel, not close.
    const t = setTimeout(() => {
      const inContent = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      const el =
        inContent ??
        Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).find(
          (node) => node.getAttribute("aria-label") !== "Close",
        );
      el?.focus();
    }, 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      // Restore the pre-lock scroll position (pinning reset it to the top).
      window.scrollTo(0, scrollY);
      clearTimeout(t);
    };
  }, [open, onClose, busy]);

  if (!open || typeof document === "undefined") return null;

  const maxW = size === "sm" ? "sm:max-w-sm" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-overlay/60 animate-fade-in" onClick={busy ? undefined : onClose} aria-hidden />
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface shadow-pop",
          "rounded-none border-2 border-border animate-sheet-up",
          "sm:rounded-none sm:shadow-stamp-lg sm:animate-scale-in",
          maxW,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-none border border-transparent p-1 text-muted transition-colors hover:border-border hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div ref={contentRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <div className="border-t border-border bg-surface-2/50 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
