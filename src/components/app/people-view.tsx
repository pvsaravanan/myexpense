"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { ChevronDown, ChevronUp, Plus, Trash2, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Money } from "@/components/money";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useAppData } from "./app-data";
import { ApiError, apiDelete, apiPatch, apiPost, swrFetcher } from "@/lib/http";
import { formatDate, fromISODate, toISODate } from "@/lib/dates";
import { toPaise } from "@/lib/money";
import type { ContactDTO, ShareDirection } from "@/lib/types";
import type { ContactShareRow } from "@/lib/contacts-service";
import { cn } from "@/lib/cn";

const SWATCHES = [
  "#64748b", "#0d9488", "#6366f1", "#f97316", "#84cc16",
  "#06b6d4", "#ef4444", "#ec4899", "#a855f7", "#f59e0b",
];

export function PeopleView({ contacts: initial }: { contacts: ContactDTO[] }) {
  const { refresh } = useAppData();
  const toast = useToast();
  const confirm = useConfirm();

  const [contacts, setContacts] = useState(initial);
  useEffect(() => setContacts(initial), [initial]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContactDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const active = contacts.filter((c) => !c.isArchived);
  const archived = contacts.filter((c) => c.isArchived);
  const totalOwedToYou = active.reduce((sum, c) => sum + c.owedToYou, 0);
  const totalYouOwe = active.reduce((sum, c) => sum + c.youOwe, 0);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(c: ContactDTO) {
    setEditing(c);
    setFormOpen(true);
  }

  async function onDelete(c: ContactDTO) {
    const ok = await confirm({
      title: `Remove ${c.name}?`,
      message:
        c.owedToYou > 0
          ? "They still owe you money on unsettled shares. If they have any split history, they'll be archived instead of removed."
          : "If they have any split history, they'll be archived instead of removed.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await apiDelete<{ contacts: ContactDTO[] }>(`/api/contacts/${c.id}`);
      setContacts(res.contacts);
      refresh();
      toast.success(`${c.name} removed`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove this person.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-border bg-surface-2 px-4 py-3">
        <div className="flex gap-6">
          <div>
            <p className="text-xs font-medium text-muted">Owed to you</p>
            <Money paise={totalOwedToYou} tone="income" className="text-2xl font-semibold" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted">You owe</p>
            <Money paise={totalYouOwe} tone="expense" className="text-2xl font-semibold" />
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add person
        </Button>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-none border border-border bg-surface">
          <EmptyState
            icon={<UserCircle2 className="h-5 w-5" />}
            title="No one yet"
            description="Add a person to split expenses with them and track who owes what."
            action={
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add person
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {active.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId((cur) => (cur === c.id ? null : c.id))}
                onEdit={() => openEdit(c)}
                onDelete={() => onDelete(c)}
                onSettled={refresh}
              />
            ))}
          </ul>

          {archived.length > 0 && (
            <div className="space-y-2 pt-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-faint">Archived</h2>
              <ul className="space-y-2">
                {archived.map((c) => (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    expanded={expandedId === c.id}
                    onToggle={() => setExpandedId((cur) => (cur === c.id ? null : c.id))}
                    onEdit={() => openEdit(c)}
                    onDelete={() => onDelete(c)}
                    onSettled={refresh}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit person" : "Add person"}
        description={editing ? undefined : "Give them a name so you can split expenses with them."}
        busy={busy}
      >
        <ContactForm
          key={editing?.id ?? "new"}
          initial={editing}
          onSaved={(next) => {
            setContacts(next);
            refresh();
            toast.success(editing ? "Person updated" : "Person added");
            setFormOpen(false);
          }}
          onCancel={() => setFormOpen(false)}
          onBusyChange={setBusy}
        />
      </Modal>
    </div>
  );
}

function ContactCard({
  contact,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onSettled,
}: {
  contact: ContactDTO;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSettled: () => void;
}) {
  const initials = contact.name.slice(0, 2).toUpperCase();
  return (
    <li className={cn("rounded-none border border-border bg-surface", contact.isArchived && "opacity-70")}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none text-sm font-semibold"
          style={{ color: contact.color, borderColor: contact.color }}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-fg">{contact.name}</p>
            {contact.isArchived && <Badge tone="neutral">Archived</Badge>}
          </div>
          <p className="text-xs text-muted">
            {contact.net > 0 ? "Owes you" : contact.net < 0 ? "You owe" : "All settled up"}
          </p>
        </div>
        {contact.net !== 0 && (
          <Money paise={Math.abs(contact.net)} tone={contact.net > 0 ? "income" : "expense"} className="text-base font-semibold" />
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-faint" /> : <ChevronDown className="h-4 w-4 text-faint" />}
      </button>

      {expanded && (
        <div className="border-t border-border p-4 pt-3">
          <div className="mb-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-expense" />
              Remove
            </Button>
          </div>
          <ContactShares contact={contact} onSettled={onSettled} />
        </div>
      )}
    </li>
  );
}

function ContactShares({ contact, onSettled }: { contact: ContactDTO; onSettled: () => void }) {
  const { data, mutate } = useSWR<{ shares: ContactShareRow[] }>(`/api/contacts/${contact.id}/shares`, swrFetcher);
  const [settling, setSettling] = useState<ContactShareRow | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const toast = useToast();

  const shares = data?.shares ?? [];

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-label-sm uppercase text-faint">Ledger</span>
        <button type="button" onClick={() => setRecordOpen(true)} className="text-label-sm uppercase text-brand-hover hover:underline">
          + Record entry
        </button>
      </div>

      {data && shares.length === 0 ? (
        <p className="text-sm text-muted">No shared expenses with {contact.name} yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {shares.map((s) => {
            const youOwe = s.direction === "you_owe";
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-none border border-border-faint bg-surface-2/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{s.description}</p>
                  <p className="text-2xs text-faint">
                    {youOwe ? "You owe" : "Owes you"} · {formatDate(fromISODate(s.date) ?? new Date())}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Money paise={s.amount} tone={youOwe ? "expense" : "income"} className="text-sm font-medium" />
                  {s.settled ? (
                    <Badge tone="neutral">Settled</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setSettling(s)}>Settle</Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SettleModal
        share={settling}
        contactName={contact.name}
        onClose={() => setSettling(null)}
        onSettled={() => {
          setSettling(null);
          mutate();
          onSettled();
          toast.success("Marked as settled");
        }}
      />

      <RecordEntryModal
        contact={contact}
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onRecorded={() => {
          setRecordOpen(false);
          mutate();
          onSettled();
          toast.success("Entry recorded");
        }}
      />
    </>
  );
}

function RecordEntryModal({
  contact,
  open,
  onClose,
  onRecorded,
}: {
  contact: ContactDTO;
  open: boolean;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [direction, setDirection] = useState<ShareDirection>("you_owe");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    setBusy(true);
    try {
      await apiPost(`/api/contacts/${contact.id}/shares`, {
        amount: paise,
        direction,
        description: description.trim() || null,
        date,
      });
      onRecorded();
      // Reset for next time.
      setAmount("");
      setDescription("");
      setDirection("you_owe");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record this entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record entry" description={`A debt between you and ${contact.name}.`} busy={busy} size="sm">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <div className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">{error}</div>}
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: "you_owe" as ShareDirection, label: `You owe ${contact.name}` },
            { value: "owed_to_you" as ShareDirection, label: `${contact.name} owes you` },
          ]}
          size="sm"
          className="w-full [&>button]:flex-1"
        />
        <Field label="Amount (₹)" htmlFor="entry-amount" required>
          <Input id="entry-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" autoFocus />
        </Field>
        <Field label="Description" htmlFor="entry-desc">
          <Input id="entry-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Movie tickets, Lunch" />
        </Field>
        <Field label="Date" htmlFor="entry-date">
          <Input id="entry-date" type="date" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy} className="flex-1">Cancel</Button>
          <Button type="submit" loading={busy} className="flex-1">Record</Button>
        </div>
      </form>
    </Modal>
  );
}

function SettleModal({
  share,
  contactName,
  onClose,
  onSettled,
}: {
  share: ContactShareRow | null;
  contactName: string;
  onClose: () => void;
  onSettled: () => void;
}) {
  const { accounts, preference } = useAppData();
  const [record, setRecord] = useState(true);
  const [accountId, setAccountId] = useState(preference.defaultAccountId ?? accounts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const youOwe = share?.direction === "you_owe";

  async function onConfirm() {
    if (!share) return;
    setBusy(true);
    try {
      await apiPost(`/api/shares/${share.id}/settle`, {
        record,
        accountId: record ? accountId : null,
      });
      onSettled();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!share}
      onClose={onClose}
      title="Settle up"
      description={
        share
          ? youOwe
            ? `Mark "${share.description}" as paid to ${contactName}.`
            : `Mark "${share.description}" as settled by ${contactName}.`
          : undefined
      }
      busy={busy}
      size="sm"
      footer={
        share && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy} className="flex-1">Cancel</Button>
            <Button onClick={onConfirm} loading={busy} className="flex-1">Settle</Button>
          </div>
        )
      }
    >
      {share && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-none border border-border bg-surface-2 px-3 py-2">
            <span className="text-sm text-muted">Amount</span>
            <Money paise={share.amount} tone={youOwe ? "expense" : "income"} className="text-lg font-semibold" />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} className="h-4 w-4" />
            {youOwe ? "Also record this as an expense (money paid)" : "Also record this as income (money received)"}
          </label>
          {record && (
            <Field label={youOwe ? "Pay from" : "Deposit into"} htmlFor="settle-account">
              <Select id="settle-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
}

function ContactForm({
  initial,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  initial: ContactDTO | null;
  onSaved: (contacts: ContactDTO[]) => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? SWATCHES[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => onBusyChange?.(saving), [saving, onBusyChange]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = editing
        ? await apiPatch<{ contacts: ContactDTO[] }>(`/api/contacts/${initial!.id}`, { name: name.trim(), color })
        : await apiPost<{ contacts: ContactDTO[] }>("/api/contacts", { name: name.trim(), color });
      onSaved(res.contacts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <div className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">{error}</div>
      )}
      <Field label="Name" htmlFor="contact-name" required>
        <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya, Roommate, Arjun" autoFocus />
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
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">Cancel</Button>
        <Button type="submit" loading={saving} className="flex-1">{editing ? "Save changes" : "Add person"}</Button>
      </div>
    </form>
  );
}
