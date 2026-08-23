"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, Progress, EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { Money } from "@/components/money";
import { Icon } from "@/components/icon";
import { GoalForm } from "./goal-form";
import { useAppData } from "./app-data";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { ApiError, apiDelete, apiPost } from "@/lib/http";
import { toPaise, formatPercent } from "@/lib/money";
import { fromISODate, formatDate, toISODate } from "@/lib/dates";
import { monthlyContributionNeeded } from "@/lib/calculations";
import type { GoalDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

export function GoalsView({ goals: initial }: { goals: GoalDTO[] }) {
  const { refresh } = useAppData();
  const toast = useToast();

  const [goals, setGoals] = useState<GoalDTO[]>(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalDTO | null>(null);
  const [contributing, setContributing] = useState<GoalDTO | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  // Keep local state in sync with fresh server data after refresh().
  useEffect(() => setGoals(initial), [initial]);

  const active = goals.filter((g) => g.status !== "archived");
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);
  const overallPct = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  function applyGoals(next: GoalDTO[]) {
    setGoals(next);
    refresh();
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(goal: GoalDTO) {
    setEditing(goal);
    setFormOpen(true);
  }

  if (goals.length === 0) {
    return (
      <>
        <Card>
          <EmptyState
            icon={<Icon name="target" size={22} />}
            title="No goals yet"
            description="Set a savings target — a trip, an emergency fund, a new phone — and track your progress toward it."
            action={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" />
                New goal
              </Button>
            }
          />
        </Card>
        <Modal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title="New goal"
          description="Set a target amount and, optionally, a date to reach it."
          busy={formBusy}
        >
          <GoalForm
            onSaved={(next) => {
              applyGoals(next);
              setFormOpen(false);
              toast.success("Goal created");
            }}
            onCancel={() => setFormOpen(false)}
            onBusyChange={setFormBusy}
          />
        </Modal>
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header summary */}
      <div className="flex flex-col gap-4 rounded-none border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <div>
            <p className="text-xs font-medium text-muted">Total saved</p>
            <Money paise={totalSaved} tone="default" className="text-2xl font-semibold" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Across {active.length} active goal{active.length === 1 ? "" : "s"}</p>
            <p className="text-sm text-muted">
              of <Money paise={totalTarget} tone="muted" className="font-medium" /> targeted
            </p>
          </div>
          <div className="min-w-[140px] flex-1">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Overall progress</span>
              <span className="tabular-nums">{formatPercent(overallPct, 0)}</span>
            </div>
            <Progress value={overallPct} />
          </div>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="h-4 w-4" />
          New goal
        </Button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            onContribute={() => setContributing(g)}
            onEdit={() => openEdit(g)}
            onDeleted={(next) => {
              applyGoals(next);
              toast.success("Goal deleted");
            }}
          />
        ))}
      </div>

      {/* New / edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit goal" : "New goal"}
        description={editing ? undefined : "Set a target amount and, optionally, a date to reach it."}
        busy={formBusy}
      >
        <GoalForm
          initial={editing ?? undefined}
          onSaved={(next) => {
            applyGoals(next);
            setFormOpen(false);
            toast.success(editing ? "Goal updated" : "Goal created");
          }}
          onCancel={() => setFormOpen(false)}
          onBusyChange={setFormBusy}
        />
      </Modal>

      {/* Contribute modal */}
      {contributing && (
        <ContributeModal
          key={contributing.id}
          goal={goals.find((g) => g.id === contributing.id) ?? contributing}
          onClose={() => setContributing(null)}
          onSaved={(next, message) => {
            applyGoals(next);
            setContributing(null);
            toast.success(message);
          }}
        />
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onContribute,
  onEdit,
  onDeleted,
}: {
  goal: GoalDTO;
  onContribute: () => void;
  onEdit: () => void;
  onDeleted: (goals: GoalDTO[]) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);

  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const achieved = goal.status === "achieved" || goal.currentAmount >= goal.targetAmount;
  const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;

  const monthly = monthlyContributionNeeded(
    goal.targetAmount,
    goal.currentAmount,
    new Date(),
    goal.targetDate ? fromISODate(goal.targetDate) : null,
  );

  async function onDelete() {
    const ok = await confirm({
      title: "Delete goal?",
      message: `"${goal.name}" and its contribution history will be permanently removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await apiDelete<{ goals: GoalDTO[] }>(`/api/goals/${goal.id}`);
      onDeleted(res.goals);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete goal.");
      setDeleting(false);
    }
  }

  return (
    <Card className={cn("flex flex-col", deleting && "opacity-50")}>
      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none"
            style={{ backgroundColor: `${goal.color}1a`, color: goal.color }}
          >
            <Icon name={goal.icon} size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-fg">{goal.name}</h3>
              {achieved && <Badge tone="income">Achieved 🎉</Badge>}
            </div>
            {goal.targetDate && (
              <p className="mt-0.5 text-xs text-muted">
                Target: {formatDate(fromISODate(goal.targetDate)!)}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={achieved ? 100 : pct} tone={achieved ? "income" : "brand"} />
          <div className="flex items-center justify-between text-sm">
            <Money paise={goal.currentAmount} tone="default" className="font-semibold" />
            <span className="text-xs text-muted">
              of <Money paise={goal.targetAmount} tone="muted" /> · {formatPercent(pct, 0)}
            </span>
          </div>
        </div>

        {achieved ? (
          <p className="text-xs font-medium text-income">Goal reached — nicely done!</p>
        ) : (
          <div className="space-y-0.5 text-xs text-muted">
            <p>
              <Money paise={remaining} tone="default" className="font-medium text-fg" /> left to go
            </p>
            {monthly > 0 && (
              <p>
                {goal.targetDate ? (
                  <>
                    Save <Money paise={monthly} tone="default" className="font-medium text-fg" />/month to reach by{" "}
                    {formatDate(fromISODate(goal.targetDate)!, { withYear: false })}
                  </>
                ) : (
                  <>
                    Save <Money paise={monthly} tone="default" className="font-medium text-fg" /> more to reach your goal
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button size="sm" onClick={onContribute} className="flex-1">
            <PlusCircle className="h-4 w-4" />
            Add contribution
          </Button>
          <Button size="sm" variant="secondary" onClick={onEdit} aria-label={`Edit ${goal.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            loading={deleting}
            aria-label={`Delete ${goal.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ContributeModal({
  goal,
  onClose,
  onSaved,
}: {
  goal: GoalDTO;
  onClose: () => void;
  onSaved: (goals: GoalDTO[], message: string) => void;
}) {
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFormError(null);

    let paise = 0;
    try {
      paise = toPaise(amount);
    } catch {
      setError("Enter a valid amount");
      return;
    }
    if (paise <= 0) {
      setError("Amount must be greater than zero");
      return;
    }

    const signed = mode === "withdraw" ? -paise : paise;

    setSaving(true);
    try {
      const res = await apiPost<{ goals: GoalDTO[] }>(`/api/goals/${goal.id}/contribute`, {
        amount: signed,
        date,
        note: note.trim() || null,
      });
      onSaved(res.goals, mode === "withdraw" ? "Withdrawal recorded" : "Contribution added");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save. Please try again.");
      setSaving(false);
    }
  }

  const recent = goal.contributions.slice(0, 5);

  return (
    <Modal open onClose={onClose} title={goal.name} description="Add money toward this goal or record a withdrawal." busy={saving}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && (
          <div className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
            {formError}
          </div>
        )}

        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "add", label: "Add" },
            { value: "withdraw", label: "Withdraw" },
          ]}
          className="w-full [&>button]:flex-1"
        />

        <div>
          <label htmlFor="contrib-amount" className="block text-xs font-medium text-muted">
            Amount
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium text-muted">
              ₹
            </span>
            <input
              id="contrib-amount"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className={cn(
                "tnum w-full rounded-none border bg-surface py-2.5 pl-8 pr-3 text-2xl font-semibold text-fg",
                "focus:outline-none focus:ring-2 focus:ring-ring/30",
                error ? "border-expense" : "border-border focus:border-tertiary",
              )}
            />
          </div>
          {error && <p className="mt-1 text-xs text-expense">{error}</p>}
        </div>

        <Field label="Date" htmlFor="contrib-date">
          <Input
            id="contrib-date"
            type="date"
            value={date}
            max={toISODate(new Date())}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="Note" htmlFor="contrib-note" hint="Optional">
          <Textarea
            id="contrib-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Diwali bonus, monthly SIP"
          />
        </Field>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={saving} variant={mode === "withdraw" ? "danger" : "primary"} className="flex-1">
            {mode === "withdraw" ? "Withdraw" : "Add contribution"}
          </Button>
        </div>
      </form>

      {recent.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted">Recent activity</p>
          <ul className="space-y-1.5">
            {recent.map((c) => {
              const d = fromISODate(c.date.slice(0, 10));
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-fg">{d ? formatDate(d) : c.date.slice(0, 10)}</span>
                    {c.note && <span className="ml-2 truncate text-xs text-muted">{c.note}</span>}
                  </div>
                  <Money
                    paise={c.amount}
                    tone={c.amount < 0 ? "expense" : "income"}
                    sign
                    className="shrink-0 text-sm font-medium"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
