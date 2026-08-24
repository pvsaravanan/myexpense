"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { Modal } from "@/components/ui/modal";
import { TransactionForm } from "./transaction-form";
import { useAppData } from "./app-data";
import { useToast } from "@/components/ui/toast";
import { apiGet } from "@/lib/http";
import type { TransactionDTO } from "@/lib/types";

interface TransactionModalValue {
  openAdd: (prefill?: { date?: string }) => void;
  openEdit: (txn: TransactionDTO) => void;
}

const Ctx = createContext<TransactionModalValue | null>(null);

type TxnList = { transactions: TransactionDTO[]; total: number };
type ModalState =
  | { mode: "add"; prefillDate?: string }
  | { mode: "edit"; txn: TransactionDTO; group?: TransactionDTO[] | null }
  | null;

export function TransactionModalProvider({ children }: { children: React.ReactNode }) {
  const { refresh } = useAppData();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [state, setState] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);

  const openAdd = useCallback((prefill?: { date?: string }) => setState({ mode: "add", prefillDate: prefill?.date }), []);
  const openEdit = useCallback((txn: TransactionDTO) => {
    if (!txn.splitGroupId) {
      setState({ mode: "edit", txn });
      return;
    }
    // A split expense's other parts live under the same splitGroupId — fetch
    // them all before the form renders so it opens directly in split-edit mode.
    setState({ mode: "edit", txn, group: null });
    apiGet<{ transactions: TransactionDTO[] }>(`/api/transactions/split/${txn.splitGroupId}`)
      .then((res) => {
        setState((s) => (s && s.mode === "edit" && s.txn.id === txn.id ? { ...s, group: res.transactions } : s));
      })
      .catch(() => {
        // Fall back to editing just this one row rather than getting stuck loading.
        setState((s) => (s && s.mode === "edit" && s.txn.id === txn.id ? { mode: "edit", txn } : s));
      });
  }, []);
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

  const onSaved = (result: TransactionDTO | TransactionDTO[], mode: "add" | "edit") => {
    close();
    const saved = Array.isArray(result) ? result : [result];
    // Paint the saved row(s) into every transactions-list cache immediately so
    // the change shows the instant the modal closes, without waiting on the
    // round trip to the hosted DB. `refresh()` below then reconciles in the
    // background (ordering, filters, server-rendered tiles).
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/transactions"),
      (curr?: TxnList) => {
        if (!curr) return curr;
        let transactions = curr.transactions.slice();
        let total = curr.total;
        for (const txn of saved) {
          const idx = transactions.findIndex((t) => t.id === txn.id);
          if (idx === -1) {
            if (mode === "add") {
              transactions = [txn, ...transactions];
              total += 1;
            }
          } else {
            transactions[idx] = txn;
          }
        }
        return { transactions, total };
      },
      { revalidate: false },
    );
    refresh();
    toast.success(mode === "add" ? (saved.length > 1 ? "Split expense added" : "Transaction added") : "Changes saved");
  };

  const loadingGroup = state?.mode === "edit" && state.group === null;

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
        {state && loadingGroup && (
          <div className="flex justify-center py-10 text-sm text-muted">Loading…</div>
        )}
        {state && !loadingGroup && (
          <TransactionForm
            key={state.mode === "edit" ? state.txn.id : "add"}
            initial={state.mode === "edit" ? state.txn : undefined}
            initialGroup={state.mode === "edit" && state.group ? state.group : undefined}
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
