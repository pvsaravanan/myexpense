"use client";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useAppData } from "./app-data";
import { ApiError, apiPatch, apiPost } from "@/lib/http";
import { toISODate } from "@/lib/dates";
import { toPaise, toRupees } from "@/lib/money";
import { suggestCategory } from "@/lib/categorize";
import { QuickCategoryModal } from "./quick-category-modal";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type TransactionType } from "@/lib/constants";
import type { TransactionDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "refund", label: "Refund" },
];

export function TransactionForm({
  initial,
  prefillDate,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  initial?: TransactionDTO;
  prefillDate?: string;
  onSaved: (txn: TransactionDTO) => void;
  onCancel?: () => void;
  /** Notifies the parent (which owns the Modal) while a save is in flight. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const { accounts, categories, preference } = useAppData();
  const editing = !!initial;

  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? String(toRupees(initial.amount)) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.date ?? prefillDate ?? toISODate(new Date()));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [newCatOpen, setNewCatOpen] = useState(false);
  const fallbackAccountId = accounts.find((a) => a.id === preference.defaultAccountId)?.id ?? accounts[0]?.id ?? "";
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? fallbackAccountId,
  );
  const [transferAccountId, setTransferAccountId] = useState(initial?.transferAccountId ?? "");
  const initialMethodIsCustom = initial?.paymentMethod ? !PAYMENT_METHODS.includes(initial.paymentMethod as any) : false;
  const [methodSelect, setMethodSelect] = useState<string>(initialMethodIsCustom ? "__custom__" : initial?.paymentMethod ?? "upi");
  const [customMethod, setCustomMethod] = useState<string>(initialMethodIsCustom ? initial?.paymentMethod ?? "" : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [showNotes, setShowNotes] = useState(!!initial?.notes);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [touchedCategory, setTouchedCategory] = useState(editing);

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

  // Deterministic category suggestion from the description.
  const suggestion = useMemo(() => {
    if (isTransfer || touchedCategory || categoryId) return null;
    const name = suggestCategory(description);
    if (!name) return null;
    const match = eligibleCategories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return match ?? null;
  }, [description, isTransfer, touchedCategory, categoryId, eligibleCategories]);

  function addTag(value: string) {
    const v = value.trim();
    if (v && !tags.includes(v)) setTags((t) => [...t, v]);
    setTagInput("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const localErrors: Record<string, string> = {};
    let paise = 0;
    let amountParsed = true;
    try {
      paise = toPaise(amount);
    } catch {
      localErrors.amount = "Enter a valid amount";
      amountParsed = false;
    }
    // Only apply the "greater than zero" message when the value actually parsed,
    // so a parse failure keeps its own (accurate) message.
    if (amountParsed && paise <= 0) localErrors.amount = "Amount must be greater than zero";
    if (!description.trim()) localErrors.description = "Description is required";
    if (!accountId) localErrors.accountId = "Choose an account";
    if (isTransfer && (!transferAccountId || transferAccountId === accountId)) {
      localErrors.transferAccountId = "Choose a different destination account";
    }
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    const payload = {
      type,
      amount: paise,
      description: description.trim(),
      date,
      categoryId: isTransfer ? null : categoryId || null,
      accountId,
      transferAccountId: isTransfer ? transferAccountId : null,
      paymentMethod: isTransfer
        ? null
        : (methodSelect === "__custom__" ? customMethod.trim().toLowerCase() : methodSelect) || null,
      notes: notes.trim() || null,
      tags,
    };

    setSaving(true);
    try {
      const res = editing
        ? await apiPatch<{ transaction: TransactionDTO }>(`/api/transactions/${initial!.id}`, payload)
        : await apiPost<{ transaction: TransactionDTO }>("/api/transactions", payload);
      onSaved(res.transaction);
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

      <Segmented
        value={type}
        onChange={(v) => {
          setType(v);
          // Drop the selected category if it isn't eligible for the new type.
          // Without this, switching (e.g.) Income → Expense keeps a stale
          // income-kind category id in state — invisible in the UI (it falls
          // back to "Uncategorized") but silently submitted on save.
          setCategoryId((prev) => {
            if (!prev || v === "transfer") return v === "transfer" ? "" : prev;
            const cat = categories.find((c) => c.id === prev);
            if (!cat) return "";
            const ok =
              v === "income"
                ? cat.kind === "income" || cat.kind === "both"
                : cat.kind === "expense" || cat.kind === "both";
            return ok ? prev : "";
          });
        }}
        options={TYPE_OPTIONS}
        className="w-full [&>button]:flex-1"
      />

      {/* Amount — the prominent field */}
      <div>
        <label htmlFor="amount" className="block text-label-md uppercase text-muted">
          Amount
        </label>
        {/* The headline field: the most common action deserves poster-sized type. */}
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-headline-sm text-muted">
            ₹
          </span>
          <input
            id="amount"
            inputMode="decimal"
            autoFocus={!editing}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            className={cn(
              "tnum w-full rounded-none border-2 bg-surface py-2.5 pl-10 pr-4 text-headline-md tracking-tight text-fg",
              "focus:outline-none focus:ring-2 focus:ring-ring/25",
              errors.amount ? "border-expense" : "border-border focus:border-brand",
            )}
          />
        </div>
        {errors.amount && <p className="mt-1 text-body-sm text-expense">{errors.amount}</p>}
      </div>

      <Field label="Description" htmlFor="description" error={errors.description} required>
        <Input
          id="description"
          value={description}
          invalid={!!errors.description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isTransfer ? "e.g. Move to savings" : "e.g. Swiggy dinner, Uber to office"}
        />
      </Field>

      {suggestion && (
        <button
          type="button"
          onClick={() => {
            setCategoryId(suggestion.id);
            setTouchedCategory(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-none border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-hover transition-colors hover:bg-brand/15"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Suggested: {suggestion.name}
        </button>
      )}

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
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setNewCatOpen(true);
                } else {
                  setCategoryId(e.target.value);
                  setTouchedCategory(true);
                }
              }}
            >
              <option value="">Uncategorized</option>
              {eligibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__new__">+ Create new category…</option>
            </Select>
          </div>
        )}

        <Field label={isTransfer ? "From account" : "Account"} htmlFor="account" error={errors.accountId}
          className={isTransfer ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-1"}>
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
            <Select id="toAccount" value={transferAccountId} invalid={!!errors.transferAccountId} onChange={(e) => setTransferAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.filter((a) => a.id !== accountId).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Date" htmlFor="date" className="col-span-2 sm:col-span-1">
          <Input id="date" type="date" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value)} />
        </Field>

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

      {/* Tags */}
      <Field label="Tags" hint="Press Enter or comma to add.">
        <div className={cn("flex flex-wrap items-center gap-1.5 rounded-none border border-border bg-surface px-2 py-1.5")}>
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-xs text-fg">
              {t}
              <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                <X className="h-3 w-3 text-faint hover:text-fg" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(tagInput);
              } else if (e.key === "Backspace" && !tagInput && tags.length) {
                setTags((prev) => prev.slice(0, -1));
              }
            }}
            onBlur={() => tagInput && addTag(tagInput)}
            placeholder={tags.length ? "" : "Add a tag…"}
            className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm text-fg placeholder:text-faint focus:outline-none"
          />
        </div>
      </Field>

      {showNotes ? (
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional details…" />
        </Field>
      ) : (
        <button type="button" onClick={() => setShowNotes(true)} className="text-label-sm uppercase text-brand-hover underline-offset-4 hover:underline">
          + Add note
        </button>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving} className="flex-1">
          {editing ? "Save changes" : "Add transaction"}
        </Button>
      </div>

      <QuickCategoryModal
        open={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        defaultKind={type === "income" ? "income" : "expense"}
        onCreated={(newCat) => {
          setCategoryId(newCat.id);
          setTouchedCategory(true);
        }}
      />
    </form>
  );
}
