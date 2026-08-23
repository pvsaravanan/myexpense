"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "./app-data";
import { apiPost, ApiError } from "@/lib/http";
import { CATEGORY_KINDS, type CategoryKind } from "@/lib/constants";
import type { CategoryDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

const SWATCHES = [
  "#d88060", "#7d8c4a", "#4f7a72", "#8c5a3c", "#4a6785",
  "#b84b3a", "#a4566e", "#c96f4f", "#6d5b8c", "#5a7a8c",
  "#3f7d6e", "#c9942f", "#2c6b4f", "#3f6b6b", "#8a8578",
];

const ICONS = [
  "tag", "utensils", "shopping-basket", "shopping-bag", "car",
  "home", "receipt", "repeat", "plane", "clapperboard",
  "heart-pulse", "graduation-cap", "wallet", "briefcase", "landmark",
  "users", "user", "plus-circle", "trending-up", "smartphone",
];

const KIND_OPTIONS: { value: CategoryKind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "both", label: "Both" },
];

export function QuickCategoryModal({
  open,
  onClose,
  defaultKind = "expense",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultKind?: CategoryKind;
  onCreated: (cat: CategoryDTO) => void;
}) {
  const { refresh } = useAppData();
  const toast = useToast();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>(defaultKind);
  const [icon, setIcon] = useState("tag");
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await apiPost<{ createdId: string; categories: CategoryDTO[] }>("/api/categories", {
        name: name.trim(),
        kind,
        icon,
        color,
        isActive: true,
      });
      refresh();
      // Resolve by the returned id, not by name — a case-insensitive name match
      // could pick a different pre-existing category with the same name.
      const created =
        res.categories.find((c) => c.id === res.createdId) ??
        res.categories[res.categories.length - 1];
      toast.success(`Category "${name.trim()}" created`);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create category.");
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create new category"
      description="Add a custom category to organize your transactions."
      size="sm"
      busy={saving}
    >
      <form onSubmit={handleCreate} className="space-y-4">
        {error && (
          <div className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense">
            {error}
          </div>
        )}

        <Field label="Category Type / Kind" htmlFor="kind">
          <Segmented
            value={kind}
            onChange={(k) => setKind(k)}
            options={KIND_OPTIONS}
            size="sm"
            className="w-full [&>button]:flex-1"
          />
        </Field>

        <Field label="Name" htmlFor="category-name" required>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pet Care, Gadgets, Freelance"
            autoFocus
          />
        </Field>

        <div>
          <label className="block text-label-sm uppercase text-muted">Color</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setColor(hex)}
                className={cn(
                  "h-8 w-8 rounded-none border border-border transition-transform active:scale-95",
                  color === hex && "ring-2 ring-fg ring-offset-2",
                )}
                style={{ backgroundColor: hex }}
                aria-label={`Color ${hex}`}
                aria-pressed={color === hex}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-label-sm uppercase text-muted">Icon</label>
          <div className="mt-1.5 grid grid-cols-5 gap-1.5 sm:grid-cols-7 max-h-36 overflow-y-auto p-1.5 border border-border bg-surface-2/30">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-none border border-border bg-surface text-muted transition-colors active:scale-95 hover:bg-surface-2 hover:text-fg",
                  icon === i && "border-brand bg-brand text-brand-fg",
                )}
                aria-label={`Icon ${i}`}
                aria-pressed={icon === i}
              >
                <Icon name={i} size={18} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving} className="min-h-[40px] flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving} className="min-h-[40px] flex-1 sm:flex-none">
            <Plus className="h-4 w-4" />
            Create Category
          </Button>
        </div>
      </form>
    </Modal>
  );
}
