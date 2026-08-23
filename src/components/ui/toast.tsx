"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastContextValue {
  toast: (opts: { message: string; tone?: ToastTone; action?: Toast["action"]; duration?: number }) => void;
  success: (message: string, action?: Toast["action"]) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ message, tone = "info", action, duration = 4000 }) => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, tone, message, action, duration }]);
    },
    [],
  );

  const value: ToastContextValue = {
    toast,
    success: (message, action) => toast({ message, tone: "success", action }),
    error: (message) => toast({ message, tone: "error", duration: 6000 }),
    info: (message) => toast({ message, tone: "info" }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  // Only portal after mount so the first client render matches the server
  // (which renders nothing here), avoiding a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-income" />,
    error: <AlertCircle className="h-4 w-4 text-expense" />,
    info: <Info className="h-4 w-4 text-brand-hover" />,
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-none border border-border",
        "bg-surface px-4 py-3 shadow-stamp animate-slide-up",
      )}
      role="status"
    >
      {icons[toast.tone]}
      <p className="flex-1 text-sm text-fg">{toast.message}</p>
      {toast.action && (
        <button
          onClick={() => {
            // Always dismiss, even if the action handler throws — otherwise a
            // failing action leaves the toast stuck and the error uncaught.
            try {
              toast.action!.onClick();
            } finally {
              onDismiss(toast.id);
            }
          }}
          className="text-sm font-medium text-brand-hover hover:underline"
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={() => onDismiss(toast.id)} className="text-faint hover:text-fg" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
