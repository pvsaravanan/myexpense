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

interface PartRow {
  amount: string;
  categoryId: string;
  accountId: string;
}

interface ShareRow {
  contactId: string;
  amount: string;
  percent: string;
}

type ShareMode = "equal" | "percent" | "custom";

const SHARE_MODE_OPTIONS: { value: ShareMode; label: string }[] = [
  { value: "equal", label: "Equal" },
  { value: "percent", label: "%" },
  { value: "custom", label: "Custom" },
];

/** Parse a rupee string to paise, or 0 if it doesn't parse — for running totals, not submission. */
function safePaise(s: string): number {
  try {
    return toPaise(s);
  } catch {
    return 0;
  }
}

export function TransactionForm({
  initial,
  initialGroup,
  prefillDate,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  initial?: TransactionDTO;
  /** All parts of an existing split expense, when editing one. Takes priority over `initial`. */
  initialGroup?: TransactionDTO[];
  prefillDate?: string;
  onSaved: (txn: TransactionDTO | TransactionDTO[]) => void;
  onCancel?: () => void;
  /** Notifies the parent (which owns the Modal) while a save is in flight. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const { accounts, categories, contacts, preference } = useAppData();

  const editingGroup = !!initialGroup && initialGroup.length > 0;
  // Shared fields (description, date, notes…) are uniform across a split
  // group, so any row stands in for them.
  const primary = editingGroup ? initialGroup![0] : initial;
  // People-shares are attached to whichever part was created first. Since all
  // parts of a split share an identical createdAt (one DB transaction), that
  // "first" row isn't reliably initialGroup[0] after a re-fetch — so find the
  // row that actually carries the shares rather than assuming a position.
  const groupShares = editingGroup ? initialGroup!.find((t) => t.shares.length > 0)?.shares ?? [] : primary?.shares ?? [];
  const editingSingle = !!initial && !editingGroup;
  const editing = editingGroup || editingSingle;
  const splitGroupId = editingGroup ? initialGroup![0].splitGroupId! : null;

  const [type, setType] = useState<TransactionType>(editingGroup ? "expense" : primary?.type ?? "expense");
  const [amount, setAmount] = useState(primary && !editingGroup ? String(toRupees(primary.amount)) : "");
  const [description, setDescription] = useState(primary?.description ?? "");
  const [date, setDate] = useState(primary?.date ?? prefillDate ?? toISODate(new Date()));
  const [categoryId, setCategoryId] = useState(() => {
    if (primary?.categoryId) return primary.categoryId;
    // Category is mandatory now, so a brand-new expense/income form starts
    // pre-selected on the first eligible category rather than blank.
    const startType = editingGroup ? "expense" : primary?.type ?? "expense";
    if (startType === "transfer") return "";
    const wantIncome = startType === "income";
    const first = categories.find((c) => c.isActive && (wantIncome ? c.kind === "income" || c.kind === "both" : c.kind === "expense" || c.kind === "both"));
    return first?.id ?? "";
  });
  const [newCatOpen, setNewCatOpen] = useState(false);
  const fallbackAccountId = accounts.find((a) => a.id === preference.defaultAccountId)?.id ?? accounts[0]?.id ?? "";
  // Splits are always an expense breakdown — used to seed every blank split
  // row so a newly-added part isn't left uncategorized.
  const fallbackExpenseCategoryId = categories.find((c) => c.isActive && (c.kind === "expense" || c.kind === "both"))?.id ?? "";
  const [accountId, setAccountId] = useState(primary?.accountId ?? fallbackAccountId);
  const [transferAccountId, setTransferAccountId] = useState(primary?.transferAccountId ?? "");
  const initialMethodIsCustom = primary?.paymentMethod ? !PAYMENT_METHODS.includes(primary.paymentMethod as any) : false;
  const [methodSelect, setMethodSelect] = useState<string>(initialMethodIsCustom ? "__custom__" : primary?.paymentMethod ?? "upi");
  const [customMethod, setCustomMethod] = useState<string>(initialMethodIsCustom ? primary?.paymentMethod ?? "" : "");
  const [notes, setNotes] = useState(primary?.notes ?? "");
  const [showNotes, setShowNotes] = useState(!!primary?.notes);
  const [tags, setTags] = useState<string[]>(primary?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [touchedCategory, setTouchedCategory] = useState(editingSingle);

  // Split-by-category/account. Locked ON when editing an existing group;
  // otherwise only offered when creating a fresh expense (converting an
  // already-saved single transaction into a split isn't supported here).
  const [splitEnabled, setSplitEnabled] = useState(editingGroup);
  const [parts, setParts] = useState<PartRow[]>(
    editingGroup
      ? initialGroup!.map((t) => ({ amount: String(toRupees(t.amount)), categoryId: t.categoryId ?? "", accountId: t.accountId }))
      : editingSingle && primary
        ? // Converting a saved single into a split: seed part 1 from it, add a blank part 2.
          [
            { amount: String(toRupees(primary.amount)), categoryId: primary.categoryId ?? fallbackExpenseCategoryId, accountId: primary.accountId },
            { amount: "", categoryId: fallbackExpenseCategoryId, accountId: primary.accountId },
          ]
        : [
            { amount: "", categoryId: fallbackExpenseCategoryId, accountId: fallbackAccountId },
            { amount: "", categoryId: fallbackExpenseCategoryId, accountId: fallbackAccountId },
          ],
  );
  const [splitTotal, setSplitTotal] = useState("");

  // Split-with-people. Shares live on the group's primary row (or the plain
  // transaction itself) and are capped against the group/transaction total.
  const [peopleEnabled, setPeopleEnabled] = useState(groupShares.length > 0);
  const [shareMode, setShareMode] = useState<ShareMode>(groupShares.length > 0 ? "custom" : "equal");
  const [shareRows, setShareRows] = useState<ShareRow[]>(
    groupShares.map((s) => ({ contactId: s.contactId, amount: String(toRupees(s.amount)), percent: "" })),
  );

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
    if (isTransfer || splitEnabled || touchedCategory || categoryId) return null;
    const name = suggestCategory(description);
    if (!name) return null;
    const match = eligibleCategories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return match ?? null;
  }, [description, isTransfer, splitEnabled, touchedCategory, categoryId, eligibleCategories]);

  function addTag(value: string) {
    const v = value.trim();
    if (v && !tags.includes(v)) setTags((t) => [...t, v]);
    setTagInput("");
  }

  function updatePart(i: number, patch: Partial<PartRow>) {
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function addPart() {
    setParts((prev) => [...prev, { amount: "", categoryId: fallbackExpenseCategoryId, accountId: fallbackAccountId }]);
  }
  function removePart(i: number) {
    setParts((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  /** Divide the entered total equally across the current parts (remainder to the first). */
  function splitPartsEqually() {
    const total = safePaise(splitTotal);
    if (total <= 0) return;
    const n = parts.length;
    const per = Math.floor(total / n);
    const remainder = total - per * n;
    setParts((prev) => prev.map((p, i) => ({ ...p, amount: String(toRupees(per + (i === 0 ? remainder : 0))) })));
  }

  function updateShare(i: number, patch: Partial<ShareRow>) {
    setShareRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addShareRow() {
    const used = new Set(shareRows.map((r) => r.contactId));
    const next = contacts.find((c) => !c.isArchived && !used.has(c.id));
    setShareRows((prev) => [...prev, { contactId: next?.id ?? "", amount: "", percent: "" }]);
  }
  function removeShare(i: number) {
    setShareRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  const partsTotal = useMemo(() => parts.reduce((s, p) => s + safePaise(p.amount), 0), [parts]);
  const mainAmountPaise = safePaise(amount);
  const totalForShares = splitEnabled ? partsTotal : mainAmountPaise;
  const selectedShareCount = shareRows.filter((r) => r.contactId).length;

  /** A row's effective share in paise, derived from the active split mode. */
  function shareAmountPaise(row: ShareRow): number {
    if (!row.contactId) return 0;
    if (shareMode === "equal") {
      const n = selectedShareCount + 1; // participants include you
      return n > 0 ? Math.floor(totalForShares / n) : 0;
    }
    if (shareMode === "percent") {
      const pct = Number(row.percent || "0");
      return Number.isFinite(pct) && pct > 0 ? Math.round((totalForShares * pct) / 100) : 0;
    }
    return safePaise(row.amount);
  }

  const sharesTotal = shareRows.reduce((s, r) => s + shareAmountPaise(r), 0);
  const yourShare = Math.max(0, totalForShares - sharesTotal);

  const availableContacts = contacts.filter((c) => !c.isArchived);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const localErrors: Record<string, string> = {};

    if (peopleEnabled && shareRows.some((r) => !r.contactId)) {
      localErrors.shares = "Choose a person for every split row";
    }
    if (peopleEnabled && new Set(shareRows.map((r) => r.contactId).filter(Boolean)).size !== shareRows.filter((r) => r.contactId).length) {
      localErrors.shares = "Each person can only appear once";
    }
    if (peopleEnabled && sharesTotal > totalForShares) {
      localErrors.shares = "Shared amounts can't exceed the total";
    }
    const shares =
      peopleEnabled && !localErrors.shares
        ? shareRows
            .filter((r) => r.contactId)
            .map((r) => ({ contactId: r.contactId, amount: shareAmountPaise(r) }))
            .filter((s) => s.amount > 0)
        : undefined;

    if (splitEnabled) {
      if (parts.length < 2) localErrors.parts = "Add at least 2 splits";
      for (const p of parts) {
        if (!p.accountId) { localErrors.parts = "Choose an account for every split"; break; }
        if (!p.categoryId) { localErrors.parts = "Choose a category for every split"; break; }
        if (safePaise(p.amount) <= 0) { localErrors.parts = "Every split needs an amount greater than zero"; break; }
      }
      if (!description.trim()) localErrors.description = "Description is required";
      if (Object.keys(localErrors).length) {
        setErrors(localErrors);
        return;
      }

      const payload = {
        description: description.trim(),
        date,
        paymentMethod: (methodSelect === "__custom__" ? customMethod.trim().toLowerCase() : methodSelect) || null,
        notes: notes.trim() || null,
        tags,
        parts: parts.map((p) => ({ amount: safePaise(p.amount), categoryId: p.categoryId, accountId: p.accountId })),
        shares,
        // Converting a saved single expense into a split: the server replaces it.
        replaceId: editingSingle ? initial!.id : undefined,
      };

      setSaving(true);
      try {
        const res = editingGroup
          ? await apiPatch<{ transactions: TransactionDTO[] }>(`/api/transactions/split/${splitGroupId}`, payload)
          : await apiPost<{ transactions: TransactionDTO[] }>("/api/transactions", payload);
        onSaved(res.transactions);
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message);
          if (err.fields) setErrors(err.fields);
        } else setFormError("Could not save. Please try again.");
        setSaving(false);
      }
      return;
    }

    let paise = 0;
    let amountParsed = true;
    try {
      paise = toPaise(amount);
    } catch {
      localErrors.amount = "Enter a valid amount";
      amountParsed = false;
    }
    if (amountParsed && paise <= 0) localErrors.amount = "Amount must be greater than zero";
    if (!description.trim()) localErrors.description = "Description is required";
    if (!accountId) localErrors.accountId = "Choose an account";
    if (!isTransfer && !categoryId) localErrors.categoryId = "Choose a category";
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
      categoryId: isTransfer ? null : categoryId,
      accountId,
      transferAccountId: isTransfer ? transferAccountId : null,
      paymentMethod: isTransfer
        ? null
        : (methodSelect === "__custom__" ? customMethod.trim().toLowerCase() : methodSelect) || null,
      notes: notes.trim() || null,
      tags,
      shares: type === "expense" ? shares : undefined,
    };

    setSaving(true);
    try {
      const res = editingSingle
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

      {splitEnabled ? (
        <div className="rounded-none border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-fg">
          Split expense
        </div>
      ) : (
        <Segmented
          value={type}
          onChange={(v) => {
            setType(v);
            setCategoryId((prev) => {
              if (v === "transfer") return "";
              const wantIncome = v === "income";
              const matches = (c: (typeof categories)[number]) =>
                wantIncome ? c.kind === "income" || c.kind === "both" : c.kind === "expense" || c.kind === "both";
              const cat = categories.find((c) => c.id === prev);
              if (cat && matches(cat)) return prev;
              // Switching to a type the current category doesn't fit — fall
              // back to the first eligible one so the field stays filled
              // (category is mandatory) rather than reverting to blank.
              return categories.find((c) => c.isActive && matches(c))?.id ?? "";
            });
          }}
          options={TYPE_OPTIONS}
          className="w-full [&>button]:flex-1"
        />
      )}

      {!splitEnabled && (
        <div>
          <label htmlFor="amount" className="block text-label-md uppercase text-muted">
            Amount
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-headline-sm text-muted">₹</span>
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
      )}

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

      {splitEnabled ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-label-md uppercase text-muted">Splits</span>
            <span className="tnum text-sm font-semibold text-fg">Total: ₹{toRupees(partsTotal).toFixed(2)}</span>
          </div>
          {/* Quick equal-split: type a grand total, divide it across all parts. */}
          <div className="flex items-center gap-2">
            <Input
              inputMode="decimal"
              placeholder="Total ₹"
              value={splitTotal}
              onChange={(e) => setSplitTotal(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-32"
            />
            <Button type="button" variant="outline" size="sm" onClick={splitPartsEqually}>
              Split {parts.length} ways
            </Button>
          </div>
          {parts.map((part, i) => (
            <div key={i} className="relative space-y-2 rounded-none border border-border bg-surface-2/40 p-3">
              {parts.length > 2 && (
                <button
                  type="button"
                  onClick={() => removePart(i)}
                  aria-label={`Remove split ${i + 1}`}
                  className="absolute right-2 top-2 text-faint hover:text-expense"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <p className="text-2xs font-medium uppercase text-faint">Split {i + 1}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  inputMode="decimal"
                  placeholder="Amount ₹"
                  value={part.amount}
                  onChange={(e) => updatePart(i, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
                />
                <Select value={part.accountId} onChange={(e) => updatePart(i, { accountId: e.target.value })}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>
              <Select
                value={part.categoryId}
                invalid={!!errors.parts && !part.categoryId}
                onChange={(e) => updatePart(i, { categoryId: e.target.value })}
              >
                {!part.categoryId && <option value="">Choose a category…</option>}
                {eligibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          ))}
          {errors.parts && <p className="text-xs text-expense">{errors.parts}</p>}
          <button type="button" onClick={addPart} className="text-label-sm uppercase text-brand-hover hover:underline">
            + Add split
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {!isTransfer && (
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="category" className="block text-label-md uppercase text-muted">
                  Category
                </label>
                <button type="button" onClick={() => setNewCatOpen(true)} className="text-label-sm uppercase text-brand-hover hover:underline">
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
                    setTouchedCategory(true);
                  }
                }}
              >
                {!categoryId && <option value="">Choose a category…</option>}
                {eligibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="__new__">+ Create new category…</option>
              </Select>
              {errors.categoryId && <p className="text-xs text-expense">{errors.categoryId}</p>}
            </div>
          )}

          <Field label={isTransfer ? "From account" : "Account"} htmlFor="account" error={errors.accountId} className="col-span-2 sm:col-span-1">
            <Select id="account" value={accountId} invalid={!!errors.accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>

          {isTransfer && (
            <Field label="To account" htmlFor="toAccount" error={errors.transferAccountId} className="col-span-2 sm:col-span-1">
              <Select id="toAccount" value={transferAccountId} invalid={!!errors.transferAccountId} onChange={(e) => setTransferAccountId(e.target.value)}>
                <option value="">Select…</option>
                {accounts.filter((a) => a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="date" className="col-span-2 sm:col-span-1">
          <Input id="date" type="date" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value)} />
        </Field>

        {!isTransfer && (
          <div className="col-span-2 sm:col-span-1 space-y-1.5">
            <Field label="Payment method" htmlFor="method">
              <Select id="method" value={methodSelect} onChange={(e) => setMethodSelect(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
                <option value="__custom__">+ Custom payment type…</option>
              </Select>
            </Field>
            {methodSelect === "__custom__" && (
              <Input placeholder="e.g. Sodexo, Forex, Crypto, Cheque" value={customMethod} onChange={(e) => setCustomMethod(e.target.value)} autoFocus />
            )}
          </div>
        )}
      </div>

      {/* Split toggle — new expenses, or converting a saved single expense.
          An existing split group stays locked on. */}
      {type === "expense" && (
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={splitEnabled}
            disabled={editingGroup}
            onChange={(e) => setSplitEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Split across categories or accounts
          {editingGroup && <span className="text-xs text-faint">(this is a split expense)</span>}
          {editingSingle && !editingGroup && splitEnabled && (
            <span className="text-xs text-faint">(converting to a split)</span>
          )}
        </label>
      )}

      {/* Split with people — works whether or not the expense is also split by category/account. */}
      {type === "expense" && (
        <div className="space-y-2 rounded-none border border-border p-3">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={peopleEnabled} onChange={(e) => setPeopleEnabled(e.target.checked)} className="h-4 w-4" />
            Split with people
          </label>
          {peopleEnabled && (
            <div className="space-y-2 pt-1">
              {contacts.length === 0 ? (
                <p className="text-xs text-faint">No people yet — add one from the People page first.</p>
              ) : (
                <>
                  <Segmented value={shareMode} onChange={setShareMode} options={SHARE_MODE_OPTIONS} size="sm" />
                  {shareRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select value={row.contactId} onChange={(e) => updateShare(i, { contactId: e.target.value })} className="flex-1">
                        <option value="">Choose person…</option>
                        {availableContacts.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                      {shareMode === "custom" && (
                        <Input
                          inputMode="decimal"
                          placeholder="Share ₹"
                          value={row.amount}
                          onChange={(e) => updateShare(i, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
                          className="w-28"
                        />
                      )}
                      {shareMode === "percent" && (
                        <div className="flex items-center gap-1">
                          <Input
                            inputMode="decimal"
                            placeholder="%"
                            value={row.percent}
                            onChange={(e) => updateShare(i, { percent: e.target.value.replace(/[^0-9.]/g, "") })}
                            className="w-16"
                          />
                          <span className="tnum w-20 text-right text-xs text-muted">₹{toRupees(shareAmountPaise(row)).toFixed(2)}</span>
                        </div>
                      )}
                      {shareMode === "equal" && (
                        <span className="tnum w-28 text-right text-sm text-fg">₹{toRupees(shareAmountPaise(row)).toFixed(2)}</span>
                      )}
                      <button type="button" onClick={() => removeShare(i)} aria-label="Remove share">
                        <X className="h-4 w-4 text-faint hover:text-expense" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addShareRow} className="text-label-sm uppercase text-brand-hover hover:underline">
                    + Add person
                  </button>
                  {shareMode === "equal" && (
                    <p className="text-2xs text-faint">Split equally between you and {selectedShareCount} {selectedShareCount === 1 ? "other" : "others"}.</p>
                  )}
                  {errors.shares && <p className="text-xs text-expense">{errors.shares}</p>}
                  <div className="flex items-center justify-between border-t border-border-faint pt-2 text-sm">
                    <span className="text-muted">Your share</span>
                    <span className="tnum font-semibold text-fg">₹{toRupees(yourShare).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

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
