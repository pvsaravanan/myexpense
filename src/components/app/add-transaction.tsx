"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { TransactionForm } from "./transaction-form";
import { useAppData } from "./app-data";
import { useToast } from "@/components/ui/toast";
import type { TransactionDTO } from "@/lib/types";

interface TransactionModalValue {
  openAdd: (prefill?: { date?: string }) => void;
  openEdit: (txn: TransactionDTO) => void;
}

const Ctx = createContext<TransactionModalValue | null>(null);

export function TransactionModalProvider({ children }: { children: React.ReactNode }) {
  const { refresh } = useAppData();
  const toast = useToast();
  const [state, setState] = useState<
    { mode: "add"; prefillDate?: string } | { mode: "edit"; txn: TransactionDTO } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const openAdd = useCallback((prefill?: { date?: string }) => setState({ mode: "add", prefillDate: prefill?.date }), []);
  const openEdit = useCallback((txn: TransactionDTO) => setState({ mode: "edit", txn }), []);
  const close = useCallback(() => setState(null), []);

  // Keyboard shortcut: "n" opens a new transaction (unless typing in a field).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.key || e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing || state) return;
      e.preventDefault();
      openAdd();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openAdd, state]);

  const onSaved = (txn: TransactionDTO, mode: "add" | "edit") => {
    close();
    refresh();
    toast.success(mode === "add" ? "Transaction added" : "Changes saved");
  };

  return (
    <Ctx.Provider value={{ openAdd, openEdit }}>
      {children}
      <Modal
        open={state !== null}
        onClose={close}
        title={state?.mode === "edit" ? "Edit transaction" : "Add transaction"}
        description={state?.mode === "edit" ? undefined : "Record income, an expense, a transfer or a refund."}
        busy={busy}
      >
        {state && (
          <TransactionForm
            key={state.mode === "edit" ? state.txn.id : "add"}
            initial={state.mode === "edit" ? state.txn : undefined}
            prefillDate={state.mode === "add" ? state.prefillDate : undefined}
            onSaved={(txn) => onSaved(txn, state.mode)}
            onCancel={close}
            onBusyChange={setBusy}
          />
        )}
      </Modal>
    </Ctx.Provider>
  );
}

export function useTransactionModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTransactionModal must be used within TransactionModalProvider");
  return ctx;
}
