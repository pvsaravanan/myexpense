"use client";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Money } from "@/components/money";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useAppData } from "./app-data";
import { ApiError, apiDelete, apiPatch, apiPost } from "@/lib/http";
import { toPaise, toRupees } from "@/lib/money";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  formatAccountType,
  type AccountType,
} from "@/lib/constants";
import type { AccountDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

const SWATCHES = [
  "#0d9488", "#6366f1", "#f97316", "#84cc16", "#06b6d4",
  "#ef4444", "#ec4899", "#a855f7", "#f59e0b", "#64748b",
];

const ACCOUNT_ICONS = [
  "landmark", "wallet", "credit-card", "piggy-bank",
  "banknote", "building", "smartphone", "trending-up", "briefcase", "receipt",
];

export function AccountsView({ accounts: initial }: { accounts: AccountDTO[] }) {
  const { refresh } = useAppData();
  const toast = useToast();
  const confirm = useConfirm();

  const [accounts, setAccounts] = useState(initial);
  // Resync when the server-rendered prop changes — see the identical note in
  // CategoriesView; without this the list stays stale until a full reload.
  useEffect(() => setAccounts(initial), [initial]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const totalBalance = useMemo(
    () => accounts.filter((a) => !a.isArchived).reduce((sum, a) => sum + a.balance, 0),
    [accounts],
  );

  const active = accounts.filter((a) => !a.isArchived);
  const archived = accounts.filter((a) => a.isArchived);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(a: AccountDTO) {
    setEditing(a);
    setFormOpen(true);
  }

  async function onDelete(a: AccountDTO) {
    const ok = await confirm({
      title: `Delete ${a.name}?`,
      message:
        "This permanently removes the account. If it has transactions, it will be archived instead to preserve your history.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await apiDelete<{ archived: boolean; accounts: AccountDTO[] }>(`/api/accounts/${a.id}`);
      setAccounts(res.accounts);
      refresh();
      toast.success(res.archived ? `${a.name} archived (it has transactions)` : `${a.name} deleted`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete this account.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Total balance summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-border bg-surface-2 px-4 py-3">
        <div>
          <p className="text-xs font-medium text-muted">Total balance</p>
          <Money paise={totalBalance} tone="default" className="text-2xl font-semibold" />
          <p className="mt-0.5 text-2xs text-faint">
            across {active.length} active account{active.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-none border border-border bg-surface">
          <EmptyState
            icon={<Icon name="wallet" size={20} />}
            title="No accounts yet"
            description="Add a bank, wallet or card to start tracking balances."
            action={
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add account
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((a) => (
              <AccountCard key={a.id} account={a} onEdit={() => openEdit(a)} onDelete={() => onDelete(a)} />
            ))}
          </ul>

          {archived.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-faint">Archived</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((a) => (
                  <AccountCard key={a.id} account={a} onEdit={() => openEdit(a)} onDelete={() => onDelete(a)} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit account" : "Add account"}
        description={editing ? undefined : "Give the account a name, type and opening balance."}
        busy={busy}
      >
        <AccountForm
          key={editing?.id ?? "new"}
          initial={editing}
          onSaved={(next) => {
            setAccounts(next);
            refresh();
            toast.success(editing ? "Account updated" : "Account added");
            setFormOpen(false);
          }}
          onCancel={() => setFormOpen(false)}
          onBusyChange={setBusy}
        />
      </Modal>
    </div>
  );
}

function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: AccountDTO;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={cn("group relative rounded-none border border-border bg-surface p-4 shadow-card", account.isArchived && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none"
          style={{ color: account.color }}
        >
          <Icon name={account.icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-fg">{account.name}</p>
            {account.isArchived && <Badge tone="neutral">Archived</Badge>}
          </div>
          <p className="text-xs text-muted">{formatAccountType(account.type)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-2xs text-faint">Current balance</p>
          <Money paise={account.balance} tone={account.balance < 0 ? "expense" : "default"} className="text-lg font-semibold" />
        </div>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 transition-opacity focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${account.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete ${account.name}`}>
            <Trash2 className="h-4 w-4 text-expense" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function AccountForm({
  initial,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  initial: AccountDTO | null;
  onSaved: (accounts: AccountDTO[]) => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const editing = !!initial;
  const initialIsCustom = initial ? !ACCOUNT_TYPES.includes(initial.type as any) : false;
  const [name, setName] = useState(initial?.name ?? "");
  const [typeSelect, setTypeSelect] = useState<string>(initialIsCustom ? "__custom__" : initial?.type ?? "bank");
  const [customType, setCustomType] = useState<string>(initialIsCustom ? initial?.type ?? "" : "");
  const [balance, setBalance] = useState(initial ? String(toRupees(initial.openingBalance)) : "");
  const [color, setColor] = useState(initial?.color ?? SWATCHES[0]);
  const [icon, setIcon] = useState(initial?.icon ?? ACCOUNT_ICONS[0]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => onBusyChange?.(saving), [saving, onBusyChange]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const localErrors: Record<string, string> = {};
    if (!name.trim()) localErrors.name = "Name is required";

    const finalType = typeSelect === "__custom__" ? customType.trim().toLowerCase() : typeSelect;
    if (!finalType) localErrors.type = "Account type is required";

    let openingBalance = 0;
    try {
      openingBalance = balance.trim() ? toPaise(balance) : 0;
    } catch {
      localErrors.openingBalance = "Enter a valid amount";
    }
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    const payload = { name: name.trim(), type: finalType, openingBalance, color, icon };

    setSaving(true);
    try {
      const res = editing
        ? await apiPatch<{ accounts: AccountDTO[] }>(`/api/accounts/${initial!.id}`, payload)
        : await apiPost<{ accounts: AccountDTO[] }>("/api/accounts", payload);
      onSaved(res.accounts);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fields) setErrors(err.fields);
      } else setFormError("Could not save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && (
        <div className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
          {formError}
        </div>
      )}

      <Field label="Name" htmlFor="acc-name" error={errors.name} required>
        <Input
          id="acc-name"
          value={name}
          invalid={!!errors.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. HDFC Savings, Cash Wallet"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Account Type" htmlFor="acc-type" error={errors.type}>
          <Select
            id="acc-type"
            value={typeSelect}
            onChange={(e) => setTypeSelect(e.target.value)}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
            <option value="__custom__">+ Custom account type…</option>
          </Select>
        </Field>

        <Field
          label="Opening balance (₹)"
          htmlFor="acc-balance"
          error={errors.openingBalance}
          hint={errors.openingBalance ? undefined : "Negative for cards you owe on."}
        >
          <Input
            id="acc-balance"
            inputMode="decimal"
            value={balance}
            invalid={!!errors.openingBalance}
            onChange={(e) => setBalance(e.target.value.replace(/[^0-9.-]/g, ""))}
            placeholder="0"
          />
        </Field>
      </div>

      {typeSelect === "__custom__" && (
        <Field label="Custom Type Name" htmlFor="custom-type" error={errors.type} required>
          <Input
            id="custom-type"
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="e.g. Mutual Fund, PF, Crypto, Gold, Chit Fund"
            autoFocus
          />
        </Field>
      )}

      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Use color ${c}`}
              aria-pressed={color === c}
              className={cn(
                "h-8 w-8 rounded-none ring-offset-2 ring-offset-surface transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                color === c && "ring-2 ring-fg",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Field>

      <Field label="Icon">
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_ICONS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setIcon(name)}
              aria-label={`Use icon ${name}`}
              aria-pressed={icon === name}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-none border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                icon === name ? "border-brand bg-brand-soft text-brand-hover" : "border-border text-muted hover:bg-surface-2",
              )}
            >
              <Icon name={name} size={18} />
            </button>
          ))}
        </div>
      </Field>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={saving} className="flex-1">
          {editing ? "Save changes" : "Add account"}
        </Button>
      </div>
    </form>
  );
}
