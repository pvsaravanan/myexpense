"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, PiggyBank, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Badge, EmptyState, Progress } from "@/components/ui/misc";
import { Money } from "@/components/money";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "./app-data";
import { apiPut, ApiError } from "@/lib/http";
import { toPaise, toRupees, formatPercent } from "@/lib/money";
import { budgetStatus, type BudgetState, type BudgetStatus } from "@/lib/calculations";
import type { MonthKey } from "@/lib/dates";
import type { CategoryDTO } from "@/lib/types";

interface BudgetLineData {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  limit: number;
  spent: number;
  status: BudgetStatus;
}

interface BudgetData {
  overallLimit: number | null;
  overallSpent: number;
  status: BudgetStatus | null;
  lines: BudgetLineData[];
}

const PROGRESS_TONE: Record<BudgetState, "brand" | "warning" | "expense"> = {
  under: "brand",
  warning: "warning",
  over: "expense",
};

function StateBadge({ state }: { state: BudgetState }) {
  if (state === "over") return <Badge tone="expense">Over budget</Badge>;
  if (state === "warning") return <Badge tone="warning">Near limit</Badge>;
  return null;
}

function utilizationLabel(status: BudgetStatus): string {
  return Number.isFinite(status.utilization) ? formatPercent(status.utilization, 0) : "—";
}

export function BudgetsView({
  budget,
  categories,
  monthKey,
}: {
  budget: BudgetData;
  categories: CategoryDTO[];
  monthKey: MonthKey;
}) {
  const [editing, setEditing] = useState(false);

  const hasBudget = budget.overallLimit != null || budget.lines.length > 0;
  const totalLimit = budget.overallLimit ?? budget.lines.reduce((s, l) => s + l.limit, 0);
  const overallStatus =
    totalLimit > 0 ? budgetStatus(budget.overallSpent, totalLimit) : null;
  const remaining = totalLimit - budget.overallSpent;

  return (
    <div className="space-y-5">
      {!hasBudget ? (
        <Card>
          <EmptyState
            icon={<PiggyBank className="h-5 w-5" />}
            title="No budget set for this month"
            description="Set an overall monthly limit and per-category budgets to keep your spending on track."
            action={
              <Button onClick={() => setEditing(true)}>
                <Plus className="h-4 w-4" />
                Set a budget
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Overall summary */}
          <Card>
            <CardHeader
              title="Monthly budget"
              subtitle="Overall spending across all categories"
              action={
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit budget
                </Button>
              }
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Summary label="Budget">
                  <Money paise={totalLimit} tone="default" className="text-lg font-semibold" />
                </Summary>
                <Summary label="Spent">
                  <Money paise={budget.overallSpent} tone="expense" className="text-lg font-semibold" />
                </Summary>
                <Summary label={remaining >= 0 ? "Remaining" : "Over by"}>
                  <Money
                    paise={Math.abs(remaining)}
                    tone={remaining >= 0 ? "income" : "expense"}
                    className="text-lg font-semibold"
                  />
                </Summary>
                <Summary label="Utilization">
                  <span className="text-lg font-semibold tabular-nums text-fg">
                    {overallStatus ? utilizationLabel(overallStatus) : "—"}
                  </span>
                </Summary>
              </div>
              <Progress
                value={overallStatus ? overallStatus.utilization : 0}
                tone={overallStatus ? PROGRESS_TONE[overallStatus.state] : "brand"}
              />
            </CardBody>
          </Card>

          {/* Per-category budgets */}
          <Card>
            <CardHeader
              title="Category budgets"
              subtitle={`${budget.lines.length} categor${budget.lines.length === 1 ? "y" : "ies"} with a limit`}
            />
            <CardBody className="pt-1">
              {budget.lines.length === 0 ? (
                <EmptyState
                  title="No category budgets"
                  description="Add per-category limits to track spending in each area."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                      <Plus className="h-4 w-4" />
                      Add category budgets
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-border">
                  {budget.lines.map((line) => (
                    <CategoryRow key={line.categoryId} line={line} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {editing && (
        <EditBudgetModal
          open={editing}
          onClose={() => setEditing(false)}
          budget={budget}
          categories={categories}
          monthKey={monthKey}
        />
      )}
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CategoryRow({ line }: { line: BudgetLineData }) {
  const { state } = line.status;
  const remaining = line.status.remaining;
  return (
    <div className="space-y-2 py-3.5 first:pt-1">
      <div className="flex items-center gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none"
          style={{ backgroundColor: `${line.color}1a`, color: line.color }}
        >
          <Icon name={line.icon} size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-fg">{line.name}</span>
            <StateBadge state={state} />
          </div>
          <p className="mt-0.5 text-xs text-muted">
            <Money paise={line.spent} tone="default" /> of <Money paise={line.limit} tone="muted" />
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium tabular-nums text-fg">{utilizationLabel(line.status)}</p>
          <p className="mt-0.5 text-xs">
            {remaining >= 0 ? (
              <span className="text-muted">
                <Money paise={remaining} tone="income" /> left
              </span>
            ) : (
              <span className="text-expense">
                Over by <Money paise={-remaining} tone="expense" />
              </span>
            )}
          </p>
        </div>
      </div>
      <Progress value={line.status.utilization} tone={PROGRESS_TONE[state]} />
    </div>
  );
}

function EditBudgetModal({
  open,
  onClose,
  budget,
  categories,
  monthKey,
}: {
  open: boolean;
  onClose: () => void;
  budget: BudgetData;
  categories: CategoryDTO[];
  monthKey: MonthKey;
}) {
  const toast = useToast();
  const router = useRouter();
  const { refresh } = useAppData();

  const currentLimits = new Map(budget.lines.map((l) => [l.categoryId, l.limit]));

  // Saving replaces the whole category set, so the form must list every
  // category that already has a limit — including ones now inactive or
  // income-kind. Omitting them would silently delete their budgets.
  const budgetable = categories.filter(
    (c) => (c.kind !== "income" && c.isActive) || currentLimits.has(c.id),
  );

  const [overall, setOverall] = useState(
    budget.overallLimit != null ? String(toRupees(budget.overallLimit)) : "",
  );
  const [limits, setLimits] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of budgetable) {
      const existing = currentLimits.get(c.id);
      init[c.id] = existing != null ? String(toRupees(existing)) : "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sanitize = (v: string) => v.replace(/[^0-9.]/g, "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let overallLimit: number | null = null;
      if (overall.trim()) {
        const p = toPaise(overall);
        overallLimit = p > 0 ? p : null;
      }
      const cats: { categoryId: string; limit: number }[] = [];
      for (const [categoryId, value] of Object.entries(limits)) {
        if (!value.trim()) continue;
        const paise = toPaise(value);
        if (paise > 0) cats.push({ categoryId, limit: paise });
      }
      await apiPut("/api/budgets", {
        year: monthKey.year,
        month: monthKey.month,
        overallLimit,
        categories: cats,
      });
      toast.success("Budget saved");
      onClose();
      refresh(); // this is router.refresh() — calling both refetched twice
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error && e.message.startsWith("Invalid amount")
            ? "Please enter valid rupee amounts."
            : "Could not save budget. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit budget"
      description="Amounts are in rupees. Leave a field empty to remove that limit."
      size="lg"
      busy={saving}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save budget
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
            {error}
          </p>
        )}

        <Field label="Overall monthly limit (₹)" hint="Total budget across all categories.">
          <Input
            inputMode="decimal"
            value={overall}
            onChange={(e) => setOverall(sanitize(e.target.value))}
            placeholder="e.g. 50000"
          />
        </Field>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted">Per-category limits (₹)</p>
          <div className="divide-y divide-border rounded-none border border-border">
            {budgetable.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none"
                  style={{ backgroundColor: `${c.color}1a`, color: c.color }}
                >
                  <Icon name={c.icon} size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{c.name}</span>
                <Input
                  inputMode="decimal"
                  value={limits[c.id] ?? ""}
                  onChange={(e) => setLimits((prev) => ({ ...prev, [c.id]: sanitize(e.target.value) }))}
                  placeholder="0"
                  className="w-32 text-right"
                  aria-label={`${c.name} budget in rupees`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
