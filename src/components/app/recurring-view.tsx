"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CalendarClock,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  SkipForward,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Badge, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { Money } from "@/components/money";
import { Icon } from "@/components/icon";
import { RecurringForm } from "./recurring-form";
import { useAppData, useLookups } from "./app-data";
import { apiDelete, apiPatch, apiPost } from "@/lib/http";
import { fromISODate, formatDate } from "@/lib/dates";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/constants";
import type { RecurringDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

const TYPE_TONE: Record<RecurringDTO["type"], "income" | "expense" | "muted"> = {
  income: "income",
  expense: "expense",
  transfer: "muted",
};

const TYPE_BADGE: Record<RecurringDTO["type"], "income" | "expense" | "neutral"> = {
  income: "income",
  expense: "expense",
  transfer: "neutral",
};

const TYPE_LABEL: Record<RecurringDTO["type"], string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

function frequencyLabel(frequency: Frequency, interval: number): string {
  if (interval <= 1) return FREQUENCY_LABELS[frequency];
  const unit: Record<Frequency, string> = {
    daily: "days",
    weekly: "weeks",
    monthly: "months",
    quarterly: "quarters",
    yearly: "years",
  };
  return `Every ${interval} ${unit[frequency]}`;
}

export function RecurringView({ recurring }: { recurring: RecurringDTO[] }) {
  const [rules, setRules] = useState<RecurringDTO[]>(recurring);
  // Resync when the server-rendered prop changes — see the identical note in
  // CategoriesView; without this the list stays stale until a full reload.
  useEffect(() => setRules(recurring), [recurring]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const { active, inactive } = useMemo(() => {
    const byDate = (a: RecurringDTO, b: RecurringDTO) =>
      a.nextOccurrence < b.nextOccurrence ? -1 : a.nextOccurrence > b.nextOccurrence ? 1 : 0;
    return {
      active: rules.filter((r) => r.isActive).sort(byDate),
      inactive: rules.filter((r) => !r.isActive).sort(byDate),
    };
  }, [rules]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(rule: RecurringDTO) {
    setEditing(rule);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New recurring
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" />}
            title="No recurring rules yet"
            description="Set up bills, subscriptions and income you expect every period, and MyExpense will keep track of them."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New recurring
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Section
            title="Active"
            subtitle="Sorted by next occurrence"
            count={active.length}
            rules={active}
            onEdit={openEdit}
            onChange={setRules}
          />
          {inactive.length > 0 && (
            <Section
              title="Inactive / Paused"
              count={inactive.length}
              rules={inactive}
              onEdit={openEdit}
              onChange={setRules}
            />
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit recurring" : "New recurring"}
        description={editing ? "Update the schedule or amount." : "Schedule a repeating transaction."}
        busy={busy}
      >
        <RecurringForm
          initial={editing ?? undefined}
          onSaved={(list) => {
            setRules(list);
            setModalOpen(false);
          }}
          onCancel={() => setModalOpen(false)}
          onBusyChange={setBusy}
        />
      </Modal>
    </div>
  );
}

function Section({
  title,
  subtitle,
  count,
  rules,
  onEdit,
  onChange,
}: {
  title: string;
  subtitle?: string;
  count: number;
  rules: RecurringDTO[];
  onEdit: (rule: RecurringDTO) => void;
  onChange: (list: RecurringDTO[]) => void;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline gap-2 px-1">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <span className="text-xs text-muted">{count}</span>
        {subtitle && <span className="ml-auto text-xs text-faint">{subtitle}</span>}
      </div>
      <Card className="divide-y divide-border">
        {rules.map((rule) => (
          <RecurringRow key={rule.id} rule={rule} onEdit={onEdit} onChange={onChange} />
        ))}
      </Card>
    </section>
  );
}

function RecurringRow({
  rule,
  onEdit,
  onChange,
}: {
  rule: RecurringDTO;
  onEdit: (rule: RecurringDTO) => void;
  onChange: (list: RecurringDTO[]) => void;
}) {
  const { refresh } = useAppData();
  const { accountName, category } = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isTransfer = rule.type === "transfer";
  const cat = rule.categoryId ? category(rule.categoryId) : null;
  const nextDate = fromISODate(rule.nextOccurrence);

  const meta = isTransfer
    ? `${accountName(rule.accountId)} → ${accountName(rule.transferAccountId)}`
    : [cat?.name ?? "Uncategorized", accountName(rule.accountId)].join(" · ");

  async function run(action: () => Promise<{ recurring: RecurringDTO[] }>, success: string, failure: string) {
    setMenuOpen(false);
    setBusy(true);
    try {
      const res = await action();
      onChange(res.recurring);
      refresh();
      toast.success(success);
    } catch {
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  }

  function rulePayload(r: RecurringDTO) {
    return {
      name: r.name,
      type: r.type,
      amount: r.amount,
      categoryId: r.categoryId,
      accountId: r.accountId,
      transferAccountId: r.transferAccountId,
      paymentMethod: r.paymentMethod,
      notes: r.notes,
      frequency: r.frequency,
      interval: r.interval,
      startDate: r.startDate,
      endDate: r.endDate,
      autoPost: r.autoPost,
      isActive: r.isActive,
    };
  }

  const onPostNow = () =>
    run(
      () => apiPost<{ recurring: RecurringDTO[] }>(`/api/recurring/${rule.id}/post`),
      `Posted "${rule.name}" and advanced the schedule`,
      "Could not post this occurrence",
    );

  const onSkip = () =>
    run(
      () => apiPost<{ recurring: RecurringDTO[] }>(`/api/recurring/${rule.id}/skip`),
      "Skipped to the next occurrence",
      "Could not skip this occurrence",
    );

  const onToggleActive = () =>
    run(
      () =>
        apiPatch<{ recurring: RecurringDTO[] }>(`/api/recurring/${rule.id}`, {
          ...rulePayload(rule),
          isActive: !rule.isActive,
        }),
      rule.isActive ? "Recurring paused" : "Recurring resumed",
      "Could not update this recurring",
    );

  async function onDelete() {
    setMenuOpen(false);
    const ok = await confirm({
      title: "Delete recurring?",
      message: `"${rule.name}" will be removed. Transactions already posted are kept.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await run(
      () => apiDelete<{ recurring: RecurringDTO[] }>(`/api/recurring/${rule.id}`),
      "Recurring deleted",
      "Could not delete this recurring",
    );
  }

  return (
    <div className={cn("relative flex items-center gap-3 px-4 py-3 transition-opacity", busy && "opacity-50")}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none"
        style={{
          backgroundColor: isTransfer ? "hsl(var(--surface-2))" : `${cat?.color ?? "#94a3b8"}1f`,
          color: cat?.color ?? "#94a3b8",
        }}
      >
        {isTransfer ? (
          <ArrowLeftRight className="h-4 w-4 text-muted" />
        ) : (
          <Icon name={cat?.icon ?? "circle-dot"} size={16} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-fg">{rule.name}</p>
          <Badge tone={TYPE_BADGE[rule.type]}>{TYPE_LABEL[rule.type]}</Badge>
          {rule.autoPost && (
            <span className="inline-flex items-center gap-0.5 rounded bg-brand-soft px-1.5 py-0.5 text-2xs font-medium text-brand-hover">
              <Zap className="h-3 w-3" />
              Auto
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {meta} · {frequencyLabel(rule.frequency, rule.interval)}
        </p>
      </div>

      <div className="hidden shrink-0 flex-col items-end sm:flex">
        <Money paise={rule.amount} tone={TYPE_TONE[rule.type]} className="text-sm font-semibold" />
        <span className="mt-0.5 flex items-center gap-1 text-2xs text-faint">
          <CalendarClock className="h-3 w-3" />
          {rule.isActive ? "Next" : "Was due"} {nextDate ? formatDate(nextDate, { withYear: false }) : "—"}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end sm:hidden">
        <Money paise={rule.amount} tone={TYPE_TONE[rule.type]} className="text-sm font-semibold" />
      </div>

      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          disabled={busy}
          className="rounded-none p-1 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label={`Actions for ${rule.name}`}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-none border border-border bg-surface p-1 shadow-pop animate-scale-in">
              <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => { setMenuOpen(false); onEdit(rule); }}>
                Edit
              </MenuItem>
              <MenuItem icon={<Zap className="h-4 w-4" />} onClick={onPostNow}>
                Post now
              </MenuItem>
              <MenuItem icon={<SkipForward className="h-4 w-4" />} onClick={onSkip}>
                Skip next
              </MenuItem>
              <MenuItem
                icon={rule.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                onClick={onToggleActive}
              >
                {rule.isActive ? "Pause" : "Resume"}
              </MenuItem>
              <MenuItem icon={<Trash2 className="h-4 w-4" />} onClick={onDelete} danger>
                Delete
              </MenuItem>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
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
