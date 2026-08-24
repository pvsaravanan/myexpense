"use client";
import { useState } from "react";
import { ArrowLeftRight, Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { useAppData, useLookups } from "./app-data";
import { useTransactionModal } from "./add-transaction";
import { useToast } from "@/components/ui/toast";
import { apiDelete, apiPost } from "@/lib/http";
import { fromISODate, formatRelativeDay } from "@/lib/dates";
import { formatPaymentMethod } from "@/lib/constants";
import type { TransactionDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

const TONE: Record<string, "income" | "expense" | "muted" | "default"> = {
  income: "income",
  refund: "income",
  expense: "expense",
  transfer: "muted",
};

export function TransactionRow({
  txn,
  showDate = true,
  onChanged,
}: {
  txn: TransactionDTO;
  showDate?: boolean;
  onChanged?: () => void;
}) {
  const { refresh } = useAppData();
  const { category, accountName } = useLookups();
  const { openEdit } = useTransactionModal();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const cat = txn.categoryId ? category(txn.categoryId) : null;
  const isTransfer = txn.type === "transfer";
  const signed = txn.type === "expense" ? -txn.amount : txn.type === "transfer" ? txn.amount : txn.amount;

  const done = () => {
    refresh();
    onChanged?.();
  };

  async function onDelete() {
    setBusy(true);
    setMenuOpen(false);
    try {
      if (txn.splitGroupId) {
        // Every part of a split expense is one logical purchase — delete them together.
        await apiDelete(`/api/transactions/split/${txn.splitGroupId}`);
        done();
        toast.success("Split expense deleted");
        return;
      }
      await apiDelete(`/api/transactions/${txn.id}`);
      done();
      toast.success("Transaction deleted", {
        label: "Undo",
        onClick: async () => {
          await apiPost(`/api/transactions/${txn.id}/restore`).catch(() => {});
          done();
        },
      });
    } catch {
      toast.error("Could not delete the transaction");
      setBusy(false);
    }
  }

  async function onDuplicate() {
    setMenuOpen(false);
    try {
      await apiPost(`/api/transactions/${txn.id}/duplicate`);
      done();
      toast.success("Transaction duplicated");
    } catch {
      toast.error("Could not duplicate the transaction");
    }
  }

  const meta = [
    isTransfer ? `${accountName(txn.accountId)} → ${accountName(txn.transferAccountId)}` : cat?.name ?? "Uncategorized",
    !isTransfer ? accountName(txn.accountId) : null,
    txn.paymentMethod ? formatPaymentMethod(txn.paymentMethod) : null,
  ].filter(Boolean);

  const badgeColor = isTransfer
    ? "#64748b"
    : cat?.color ?? (txn.type === "income" ? "#2c6b4f" : txn.type === "refund" ? "#3f7d6e" : "#64748b");

  const iconName = isTransfer
    ? "arrow-left-right"
    : cat?.icon
    ? cat.icon
    : txn.type === "income"
    ? "plus-circle"
    : txn.type === "refund"
    ? "trending-up"
    : "tag";

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-surface-2",
        busy && "opacity-50",
      )}
    >
      <button
        onClick={() => openEdit(txn)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none"
        style={{ color: badgeColor }}
        aria-label="Edit transaction"
      >
        <Icon name={iconName} size={20} strokeWidth={2.2} />
      </button>

      <button onClick={() => openEdit(txn)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{txn.description}</p>
          {txn.recurringId && (
            <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-2xs font-medium text-brand-hover">auto</span>
          )}
          {txn.splitGroupId && (
            <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-muted">split</span>
          )}
          {txn.shares.length > 0 && (
            <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-2xs font-medium text-brand-hover">shared</span>
          )}
        </div>
        <p className="truncate text-xs text-muted">
          {meta.join(" · ")}
          {txn.tags.length > 0 && <span className="text-faint"> · {txn.tags.map((t) => `#${t}`).join(" ")}</span>}
        </p>
      </button>

      <div className="flex shrink-0 flex-col items-end">
        <Money paise={signed} tone={TONE[txn.type]} sign={txn.type !== "expense" && txn.type !== "transfer"} className="text-sm font-semibold" />
        {showDate && <span className="text-2xs text-faint">{formatRelativeDay(fromISODate(txn.date) ?? new Date(), new Date())}</span>}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-none p-1 text-faint opacity-100 sm:opacity-0 transition-opacity hover:bg-surface hover:text-fg focus:opacity-100 sm:group-hover:opacity-100 active:bg-surface-2"
          aria-label="Transaction actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-none border border-border bg-surface p-1 shadow-pop animate-scale-in">
              <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => { setMenuOpen(false); openEdit(txn); }}>Edit</MenuItem>
              {!txn.splitGroupId && (
                <MenuItem icon={<Copy className="h-4 w-4" />} onClick={onDuplicate}>Duplicate</MenuItem>
              )}
              <MenuItem icon={<Trash2 className="h-4 w-4" />} onClick={onDelete} danger>Delete</MenuItem>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-none px-2.5 py-1.5 text-sm transition-colors hover:bg-surface-2",
        danger ? "text-expense" : "text-fg",
      )}
    >
      <span className={danger ? "text-expense" : "text-muted"}>{icon}</span>
      {children}
    </button>
  );
}
