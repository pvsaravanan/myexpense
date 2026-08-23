"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/icon";
import { useAppData } from "./app-data";
import { ApiError, apiPatch, apiPost } from "@/lib/http";
import { toPaise, toRupees } from "@/lib/money";
import type { GoalDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

const ICON_OPTIONS = [
  "target",
  "piggy-bank",
  "plane",
  "shopping-bag",
  "graduation-cap",
  "home",
];

const COLOR_OPTIONS = [
  "#0d9488",
  "#6366f1",
  "#f97316",
  "#ec4899",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ef4444",
];

export function GoalForm({
  initial,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  initial?: GoalDTO;
  onSaved: (goals: GoalDTO[]) => void;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { accounts } = useAppData();
  const editing = !!initial;

  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "target");
  const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0]);
  const [targetAmount, setTargetAmount] = useState(
    initial ? String(toRupees(initial.targetAmount)) : "",
  );
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [initialAmount, setInitialAmount] = useState("");

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

    let targetPaise = 0;
    try {
      targetPaise = toPaise(targetAmount);
    } catch {
      localErrors.targetAmount = "Enter a valid amount";
    }
    if (!localErrors.targetAmount && targetPaise <= 0) {
      localErrors.targetAmount = "Target must be greater than zero";
    }

    let startPaise = 0;
    if (!editing && initialAmount.trim()) {
      try {
        startPaise = toPaise(initialAmount);
      } catch {
        localErrors.initialAmount = "Enter a valid amount";
      }
      if (!localErrors.initialAmount && startPaise < 0) {
        localErrors.initialAmount = "Starting amount cannot be negative";
      }
    }

    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    const payload = {
      name: name.trim(),
      icon,
      color,
      targetAmount: targetPaise,
      targetDate: targetDate || null,
      accountId: accountId || null,
      ...(editing ? {} : { initialAmount: startPaise }),
    };

    setSaving(true);
    try {
      const res = editing
        ? await apiPatch<{ goals: GoalDTO[] }>(`/api/goals/${initial!.id}`, payload)
        : await apiPost<{ goals: GoalDTO[] }>("/api/goals", payload);
      onSaved(res.goals);
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

      <Field label="Name" htmlFor="goal-name" error={errors.name} required>
        <Input
          id="goal-name"
          value={name}
          invalid={!!errors.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency fund, Goa trip"
          autoFocus={!editing}
        />
      </Field>

      <Field label="Icon">
        <div className="flex flex-wrap gap-2">
          {ICON_OPTIONS.map((opt) => {
            const active = opt === icon;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setIcon(opt)}
                aria-label={opt}
                aria-pressed={active}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-none border transition-colors",
                  active
                    ? "border-brand bg-brand-soft text-brand-hover"
                    : "border-border bg-surface text-muted hover:text-fg",
                )}
              >
                <Icon name={opt} size={18} />
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((opt) => {
            const active = opt.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setColor(opt)}
                aria-label={`Color ${opt}`}
                aria-pressed={active}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-none ring-offset-2 ring-offset-surface transition-shadow",
                  active ? "ring-2 ring-fg" : "hover:ring-2 hover:ring-border",
                )}
                style={{ backgroundColor: opt }}
              >
                {active && <Check className="h-4 w-4 text-white" />}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Target amount" htmlFor="goal-target" error={errors.targetAmount} required className="col-span-2 sm:col-span-1">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
              ₹
            </span>
            <Input
              id="goal-target"
              inputMode="decimal"
              value={targetAmount}
              invalid={!!errors.targetAmount}
              onChange={(e) => setTargetAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="pl-7"
            />
          </div>
        </Field>

        <Field label="Target date" htmlFor="goal-date" hint="Optional" className="col-span-2 sm:col-span-1">
          <Input
            id="goal-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Linked account" htmlFor="goal-account" hint="Optional">
        <Select id="goal-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">No linked account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      {!editing && (
        <Field label="Starting amount" htmlFor="goal-initial" hint="Optional — already saved toward this goal" error={errors.initialAmount}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
              ₹
            </span>
            <Input
              id="goal-initial"
              inputMode="decimal"
              value={initialAmount}
              invalid={!!errors.initialAmount}
              onChange={(e) => setInitialAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="pl-7"
            />
          </div>
        </Field>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving} className="flex-1">
          {editing ? "Save changes" : "Create goal"}
        </Button>
      </div>
    </form>
  );
}
