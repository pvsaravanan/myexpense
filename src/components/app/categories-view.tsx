"use client";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Money } from "@/components/money";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useAppData } from "./app-data";
import { ApiError, apiDelete, apiPatch, apiPost } from "@/lib/http";
import { toPaise, toRupees } from "@/lib/money";
import { CATEGORY_KINDS, type CategoryKind } from "@/lib/constants";
import type { CategoryDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

const SWATCHES = [
  "#0d9488", "#6366f1", "#f97316", "#84cc16", "#06b6d4",
  "#ef4444", "#ec4899", "#a855f7", "#f59e0b", "#64748b",
];

const CATEGORY_ICONS = [
  "home", "utensils", "shopping-basket", "car", "graduation-cap",
  "heart-pulse", "heart", "clapperboard", "shopping-bag", "repeat",
  "receipt", "plane", "user", "users", "landmark",
  "wallet", "briefcase", "trending-up", "plus-circle", "circle-dot",
  "tag", "target", "smartphone", "wifi", "banknote",
];

const KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Expense",
  income: "Income",
  both: "Both / Other",
};

const KIND_GROUPS: { kind: CategoryKind; title: string }[] = [
  { kind: "expense", title: "Expense" },
  { kind: "income", title: "Income" },
  { kind: "both", title: "Both / Other" },
];

export function CategoriesView({ categories: initial }: { categories: CategoryDTO[] }) {
  const { refresh } = useAppData();
  const toast = useToast();
  const confirm = useConfirm();

  const [categories, setCategories] = useState(initial);
  // Resync when the server-rendered prop changes (e.g. a category created
  // elsewhere, such as the quick-add flow inside the transaction modal,
  // triggers router.refresh() — without this the list stays stale until a
  // full page reload since useState(initial) only seeds on first mount).
  useEffect(() => setCategories(initial), [initial]);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  const groups = useMemo(
    () => KIND_GROUPS.map((g) => ({ ...g, items: filtered.filter((c) => c.kind === g.kind) })),
    [filtered],
  );

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(c: CategoryDTO) {
    setEditing(c);
    setFormOpen(true);
  }

  async function onDelete(c: CategoryDTO) {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      message:
        "This removes the category. If any transactions use it, they will be kept and the category deactivated instead.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await apiDelete<{ detached: boolean; categories: CategoryDTO[] }>(`/api/categories/${c.id}`);
      setCategories(res.categories);
      refresh();
      toast.success(res.detached ? `${c.name} deactivated (transactions kept)` : `${c.name} deleted`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete this category.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            className="pl-9"
            aria-label="Search categories"
          />
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add category
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-none border border-border bg-surface">
          <EmptyState
            icon={<Icon name="tag" size={20} />}
            title="No categories yet"
            description="Create categories to organize your spending and income."
            action={
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add category
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-none border border-border bg-surface">
          <EmptyState icon={<Search className="h-5 w-5" />} title="No matches" description="No categories match your search." />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.kind}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-faint">
                  {group.title}
                  <span className="text-faint">({group.items.length})</span>
                </h2>
                <ul className="divide-y divide-border rounded-none border border-border bg-surface">
                  {group.items.map((c) => (
                    <CategoryRow key={c.id} category={c} onEdit={() => openEdit(c)} onDelete={() => onDelete(c)} />
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit category" : "Add category"}
        description={editing ? undefined : "Name it, pick a kind, and optionally set a monthly budget."}
        busy={busy}
      >
        <CategoryForm
          key={editing?.id ?? "new"}
          initial={editing}
          onSaved={(next) => {
            setCategories(next);
            refresh();
            toast.success(editing ? "Category updated" : "Category added");
            setFormOpen(false);
          }}
          onCancel={() => setFormOpen(false)}
          onBusyChange={setBusy}
        />
      </Modal>
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryDTO;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={cn("group flex items-center gap-3 px-4 py-3", !category.isActive && "opacity-70")}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none"
        style={{ color: category.color }}
      >
        <Icon name={category.icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-fg">{category.name}</span>
          {category.isSystem && <Badge tone="brand">System</Badge>}
          {!category.isActive && <Badge tone="neutral">Inactive</Badge>}
        </div>
        {category.monthlyBudget != null && (
          <p className="text-xs text-muted">
            Budget <Money paise={category.monthlyBudget} tone="default" className="font-medium" /> / month
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 transition-opacity focus-within:opacity-100 sm:group-hover:opacity-100">
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${category.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete ${category.name}`}>
          <Trash2 className="h-4 w-4 text-expense" />
        </Button>
      </div>
    </li>
  );
}

function CategoryForm({
  initial,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  initial: CategoryDTO | null;
  onSaved: (categories: CategoryDTO[]) => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<CategoryKind>(initial?.kind ?? "expense");
  const [icon, setIcon] = useState(initial?.icon ?? CATEGORY_ICONS[0]);
  const [color, setColor] = useState(initial?.color ?? SWATCHES[0]);
  const [budget, setBudget] = useState(
    initial?.monthlyBudget != null ? String(toRupees(initial.monthlyBudget)) : "",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

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

    let monthlyBudget: number | null = null;
    if (budget.trim()) {
      try {
        monthlyBudget = toPaise(budget);
      } catch {
        localErrors.monthlyBudget = "Enter a valid amount";
      }
      if (monthlyBudget !== null && monthlyBudget <= 0) {
        localErrors.monthlyBudget = "Budget must be greater than zero";
      }
    }
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    const payload = { name: name.trim(), kind, icon, color, monthlyBudget, isActive };

    setSaving(true);
    try {
      const res = editing
        ? await apiPatch<{ categories: CategoryDTO[] }>(`/api/categories/${initial!.id}`, payload)
        : await apiPost<{ categories: CategoryDTO[] }>("/api/categories", payload);
      onSaved(res.categories);
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

      <Field label="Name" htmlFor="cat-name" error={errors.name} required>
        <Input
          id="cat-name"
          value={name}
          invalid={!!errors.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Groceries, Freelance"
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Kind" htmlFor="cat-kind">
          <Select id="cat-kind" value={kind} onChange={(e) => setKind(e.target.value as CategoryKind)}>
            {CATEGORY_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Monthly budget (₹)"
          htmlFor="cat-budget"
          error={errors.monthlyBudget}
          hint={errors.monthlyBudget ? undefined : "Optional"}
        >
          <Input
            id="cat-budget"
            inputMode="decimal"
            value={budget}
            invalid={!!errors.monthlyBudget}
            onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="None"
          />
        </Field>
      </div>

      <Field label="Icon">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ICONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setIcon(n)}
              aria-label={`Use icon ${n}`}
              aria-pressed={icon === n}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-none border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                icon === n ? "border-brand bg-brand-soft text-brand-hover" : "border-border text-muted hover:bg-surface-2",
              )}
            >
              <Icon name={n} size={16} />
            </button>
          ))}
        </div>
      </Field>

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

      <label className="flex items-center justify-between gap-3 rounded-none border border-border bg-surface px-3 py-2.5">
        <span className="text-sm text-fg">
          Active
          <span className="mt-0.5 block text-xs text-muted">Inactive categories are hidden when adding transactions.</span>
        </span>
        <Switch checked={isActive} onChange={setIsActive} label="Active" />
      </label>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={saving} className="flex-1">
          {editing ? "Save changes" : "Add category"}
        </Button>
      </div>
    </form>
  );
}
