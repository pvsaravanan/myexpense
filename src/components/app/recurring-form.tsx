"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useAppData } from "./app-data";
import { ApiError, apiPatch, apiPost } from "@/lib/http";
import { toISODate } from "@/lib/dates";
import { toPaise, toRupees } from "@/lib/money";
import { QuickCategoryModal } from "./quick-category-modal";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type Frequency,
  type PaymentMethod,
} from "@/lib/constants";
import type { RecurringDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

type RecurringType = RecurringDTO["type"];

const TYPE_OPTIONS: { value: RecurringType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

export function RecurringForm({
  initial,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  initial?: RecurringDTO;
  onSaved: (list: RecurringDTO[]) => void;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { accounts, categories, preference } = useAppData();
  const editing = !!initial;

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<RecurringType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? String(toRupees(initial.amount)) : "");
  const [categoryId, setCategoryId] = useState(() => {
    if (initial?.categoryId) return initial.categoryId;
    // Category is mandatory now, so a brand-new rule starts pre-selected on
    // the first eligible category rather than blank.
    const startType = initial?.type ?? "expense";
    if (startType === "transfer") return "";
    const wantIncome = startType === "income";
    const first = categories.find((c) => c.isActive && (wantIncome ? c.kind === "income" || c.kind === "both" : c.kind === "expense" || c.kind === "both"));
    return first?.id ?? "";
  });
  const [newCatOpen, setNewCatOpen] = useState(false);
  const fallbackAccountId = accounts.find((a) => a.id === preference.defaultAccountId)?.id ?? accounts[0]?.id ?? "";
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? fallbackAccountId,
  );
  const [transferAccountId, setTransferAccountId] = useState(initial?.transferAccountId ?? "");
  const initialMethodIsCustom = initial?.paymentMethod ? !PAYMENT_METHODS.includes(initial.paymentMethod as any) : false;
  const [methodSelect, setMethodSelect] = useState<string>(initialMethodIsCustom ? "__custom__" : initial?.paymentMethod ?? "upi");
  const [customMethod, setCustomMethod] = useState<string>(initialMethodIsCustom ? initial?.paymentMethod ?? "" : "");
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? "monthly");
  const [interval, setInterval] = useState(initial ? String(initial.interval) : "1");
  const [startDate, setStartDate] = useState(initial?.startDate ?? toISODate(new Date()));
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [autoPost, setAutoPost] = useState(initial?.autoPost ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => onBusyChange?.(saving), [saving, onBusyChange]);

  const isTransfer = type === "transfer";
  const eligibleCategories = useMemo(() => {
    const wantIncome = type === "income";
    return categories.filter((c) => {
      if (!c.isActive && c.id !== categoryId) return false;
      if (wantIncome) return c.kind === "income" || c.kind === "both";
      return c.kind === "expense" || c.kind === "both";
    });
  }, [categories, type, categoryId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const localErrors: Record<string, string> = {};
    if (!name.trim()) localErrors.name = "Name is required";

    let paise = 0;
    let amountParsed = true;
    try {
      paise = toPaise(amount);
    } catch {
      localErrors.amount = "Enter a valid amount";
      amountParsed = false;
    }
    if (amountParsed && paise <= 0) localErrors.amount = "Amount must be greater than zero";

    const intervalNum = Math.trunc(Number(interval));
    if (!Number.isFinite(intervalNum) || intervalNum < 1) localErrors.interval = "Must be at least 1";

    if (!accountId) localErrors.accountId = "Choose an account";
    if (!isTransfer && !categoryId) localErrors.categoryId = "Choose a category";
    if (isTransfer && (!transferAccountId || transferAccountId === accountId)) {
      localErrors.transferAccountId = "Choose a different destination account";
    }
    if (endDate && startDate && endDate < startDate) {
      localErrors.endDate = "End date must be after the start date";
    }
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      amount: paise,
      categoryId: isTransfer ? null : categoryId,
      accountId,
      transferAccountId: isTransfer ? transferAccountId : null,
      paymentMethod: isTransfer
        ? null
        : (methodSelect === "__custom__" ? customMethod.trim().toLowerCase() : methodSelect) || null,
      frequency,
      interval: intervalNum,
      startDate,
      endDate: endDate || null,
      autoPost,
      isActive,
    };

    setSaving(true);
    try {
      const res = editing
        ? await apiPatch<{ recurring: RecurringDTO[] }>(`/api/recurring/${initial!.id}`, payload)
        : await apiPost<{ recurring: RecurringDTO[] }>("/api/recurring", payload);
      onSaved(res.recurring);
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

      <Field label="Name" htmlFor="name" error={errors.name} required>
        <Input
          id="name"
          value={name}
          invalid={!!errors.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Netflix, Rent, Salary"
          autoFocus={!editing}
        />
      </Field>

      <Segmented
        value={type}
        onChange={(v) => {
          setType(v);
          // Fall back to the first eligible category for the new type (see
          // the matching note in transaction-form) — category is mandatory,
          // so this keeps the field filled instead of reverting to blank.
          setCategoryId((prev) => {
            if (v === "transfer") return "";
            const wantIncome = v === "income";
            const matches = (c: (typeof categories)[number]) =>
              wantIncome ? c.kind === "income" || c.kind === "both" : c.kind === "expense" || c.kind === "both";
            const cat = categories.find((c) => c.id === prev);
            if (cat && matches(cat)) return prev;
            return categories.find((c) => c.isActive && matches(c))?.id ?? "";
          });
        }}
        options={TYPE_OPTIONS}
        className="w-full [&>button]:flex-1"
      />

      {/* Amount */}
      <div>
        <label htmlFor="amount" className="block text-xs font-medium text-muted">
          Amount
        </label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium text-muted">
            ₹
          </span>
          <input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            className={cn(
              "tnum w-full rounded-none border bg-surface py-2.5 pl-8 pr-3 text-2xl font-semibold text-fg",
              "focus:outline-none focus:ring-2 focus:ring-ring/30",
              errors.amount ? "border-expense" : "border-border focus:border-tertiary",
            )}
          />
        </div>
        {errors.amount && <p className="mt-1 text-xs text-expense">{errors.amount}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!isTransfer && (
          <div className="col-span-2 sm:col-span-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="category" className="block text-label-md uppercase text-muted">
                Category
              </label>
              <button
                type="button"
                onClick={() => setNewCatOpen(true)}
                className="text-label-sm uppercase text-brand-hover hover:underline"
              >
                + New
              </button>
            </div>
            <Select
              id="category"
              value={categoryId}
              invalid={!!errors.categoryId}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setNewCatOpen(true);
                } else {
                  setCategoryId(e.target.value);
                }
              }}
            >
              {!categoryId && <option value="">Choose a category…</option>}
              {eligibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__new__">+ Create new category…</option>
            </Select>
            {errors.categoryId && <p className="text-xs text-expense">{errors.categoryId}</p>}
          </div>
        )}

        <Field
          label={isTransfer ? "From account" : "Account"}
          htmlFor="account"
          error={errors.accountId}
          className="col-span-2 sm:col-span-1"
        >
          <Select id="account" value={accountId} invalid={!!errors.accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>

        {isTransfer && (
          <Field label="To account" htmlFor="toAccount" error={errors.transferAccountId} className="col-span-2 sm:col-span-1">
            <Select
              id="toAccount"
              value={transferAccountId}
              invalid={!!errors.transferAccountId}
              onChange={(e) => setTransferAccountId(e.target.value)}
            >
              <option value="">Select…</option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}

        {!isTransfer && (
          <div className="col-span-2 sm:col-span-1 space-y-1.5">
            <Field label="Payment method" htmlFor="method">
              <Select
                id="method"
                value={methodSelect}
                onChange={(e) => setMethodSelect(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
                <option value="__custom__">+ Custom payment type…</option>
              </Select>
            </Field>
            {methodSelect === "__custom__" && (
              <Input
                placeholder="e.g. Sodexo, Forex, Crypto, Cheque"
                value={customMethod}
                onChange={(e) => setCustomMethod(e.target.value)}
                autoFocus
              />
            )}
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Frequency" htmlFor="frequency" className="col-span-2 sm:col-span-1">
          <Select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Repeat every" htmlFor="interval" error={errors.interval} hint="Number of periods between occurrences" className="col-span-2 sm:col-span-1">
          <Input
            id="interval"
            type="number"
            min={1}
            max={365}
            value={interval}
            invalid={!!errors.interval}
            onChange={(e) => setInterval(e.target.value)}
          />
        </Field>

        <Field label="Start date" htmlFor="startDate" className="col-span-2 sm:col-span-1">
          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>

        <Field label="End date" htmlFor="endDate" error={errors.endDate} hint="Optional" className="col-span-2 sm:col-span-1">
          <Input id="endDate" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      {/* Options */}
      <div className="space-y-2 rounded-none border border-border bg-surface-2/40 p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={autoPost}
            onChange={(e) => setAutoPost(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          />
          <span className="text-sm text-fg">
            Automatically create these transactions when due
            <span className="mt-0.5 block text-xs text-muted">Otherwise, post each occurrence manually from the list.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-brand"
          />
          <span className="text-sm text-fg">Active</span>
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving} className="flex-1">
          {editing ? "Save changes" : "Add recurring"}
        </Button>
      </div>

      <QuickCategoryModal
        open={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        defaultKind={type === "income" ? "income" : "expense"}
        onCreated={(newCat) => {
          setCategoryId(newCat.id);
        }}
      />
    </form>
  );
}
