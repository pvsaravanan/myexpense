"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useAppData } from "./app-data";
import { toPaise } from "@/lib/money";
import {
  TRANSACTION_TYPES,
  TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";

export interface ExportFilters {
  type: string;
  categoryId: string;
  accountId: string;
  paymentMethod: string;
  tag: string;
  start: string;
  end: string;
  min: string;
  max: string;
  q: string;
}

const EMPTY: ExportFilters = {
  type: "",
  categoryId: "",
  accountId: "",
  paymentMethod: "",
  tag: "",
  start: "",
  end: "",
  min: "",
  max: "",
  q: "",
};

function buildExportUrl(filters: ExportFilters): string {
  const p = new URLSearchParams();
  p.set("format", "csv");
  if (filters.type) p.set("type", filters.type);
  if (filters.categoryId) p.set("categoryId", filters.categoryId);
  if (filters.accountId) p.set("accountId", filters.accountId);
  if (filters.paymentMethod) p.set("paymentMethod", filters.paymentMethod);
  if (filters.tag) p.set("tag", filters.tag);
  if (filters.start) p.set("start", filters.start);
  if (filters.end) p.set("end", filters.end);
  if (filters.q) p.set("q", filters.q);
  try {
    if (filters.min) p.set("min", String(toPaise(filters.min)));
    if (filters.max) p.set("max", String(toPaise(filters.max)));
  } catch {
    /* ignore malformed amount */
  }
  return `/api/export?${p.toString()}`;
}

function hasAnyFilter(f: ExportFilters): boolean {
  return !!(f.type || f.categoryId || f.accountId || f.paymentMethod || f.tag || f.start || f.end || f.min || f.max || f.q);
}

export function ExportModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  /** Pre-fill from the active page filters. */
  initial?: Partial<ExportFilters>;
}) {
  const { categories, accounts, tags } = useAppData();
  const [filters, setFilters] = useState<ExportFilters>(() => ({ ...EMPTY, ...initial }));

  // Reset when re-opened with different initial filters.
  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) {
    setFilters({ ...EMPTY, ...initial });
  }
  if (open !== lastOpen) setLastOpen(open);

  const set = (patch: Partial<ExportFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <Modal open={open} onClose={onClose} title="Export transactions" description="Choose filters to narrow the export, or download everything." size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FilterField label="From date">
            <Input type="date" value={filters.start} onChange={(e) => set({ start: e.target.value })} />
          </FilterField>
          <FilterField label="To date">
            <Input type="date" value={filters.end} onChange={(e) => set({ end: e.target.value })} />
          </FilterField>
          <FilterField label="Type">
            <Select value={filters.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="">All types</option>
              {TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Category">
            <Select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Account">
            <Select value={filters.accountId} onChange={(e) => set({ accountId: e.target.value })}>
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Payment method">
            <Select value={filters.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })}>
              <option value="">Any method</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </Select>
          </FilterField>
          {tags.length > 0 && (
            <FilterField label="Tag">
              <Select value={filters.tag} onChange={(e) => set({ tag: e.target.value })}>
                <option value="">Any tag</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </Select>
            </FilterField>
          )}
          <FilterField label="Search text">
            <Input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Description, notes, merchant…" />
          </FilterField>
          <FilterField label="Min amount (₹)">
            <Input inputMode="decimal" value={filters.min} onChange={(e) => set({ min: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="0" />
          </FilterField>
          <FilterField label="Max amount (₹)">
            <Input inputMode="decimal" value={filters.max} onChange={(e) => set({ max: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="Any" />
          </FilterField>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {hasAnyFilter(filters) && (
            <Button variant="ghost" onClick={() => setFilters(EMPTY)}>
              Clear filters
            </Button>
          )}
          <div className="flex-1" />
          <a href={buildExportUrl(filters)} className="inline-flex" onClick={onClose}>
            <Button>
              <Download className="h-4 w-4" />
              {hasAnyFilter(filters) ? "Download filtered CSV" : "Download all CSV"}
            </Button>
          </a>
        </div>
      </div>
    </Modal>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
