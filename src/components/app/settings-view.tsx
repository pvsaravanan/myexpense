"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Download, LogOut, Upload } from "lucide-react";
import { DEFAULT_DASHBOARD_WIDGETS, WIDGET_LABELS, type WidgetKey } from "@/lib/constants";
import { apiPatch, apiPost, ApiError } from "@/lib/http";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { useAppData } from "@/components/app/app-data";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

interface WidgetItem {
  key: WidgetKey;
  enabled: boolean;
}

/** Build the ordered widget list: saved widgets first (in their saved order),
 *  then any newly-added defaults appended and toggled off. */
function buildWidgetItems(saved: string[]): WidgetItem[] {
  const valid = saved.filter((k): k is WidgetKey =>
    (DEFAULT_DASHBOARD_WIDGETS as readonly string[]).includes(k),
  );
  const seen = new Set<WidgetKey>(valid);
  const items: WidgetItem[] = valid.map((key) => ({ key, enabled: true }));
  for (const key of DEFAULT_DASHBOARD_WIDGETS) {
    if (!seen.has(key)) items.push({ key, enabled: false });
  }
  return items;
}

export function SettingsView() {
  const { user, accounts, preference, refresh } = useAppData();
  const { success, error } = useToast();
  const router = useRouter();

  const [signingOut, setSigningOut] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  // Resync if the saved name changes underneath us (e.g. after a refresh).
  useEffect(() => setName(user.name), [user.name]);
  const nameDirty = name.trim().length > 0 && name.trim() !== user.name;

  const [widgets, setWidgets] = useState<WidgetItem[]>(() =>
    buildWidgetItems(preference.dashboardWidgets),
  );
  const [savingLayout, setSavingLayout] = useState(false);

  // Resync when the saved layout changes underneath us (e.g. edited on another
  // tab/device, then refreshed) — the initial-state initializer runs only once.
  const savedLayoutKey = JSON.stringify(preference.dashboardWidgets);
  useEffect(() => {
    setWidgets(buildWidgetItems(preference.dashboardWidgets));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedLayoutKey]);

  const enabledOrder = useMemo(
    () => widgets.filter((w) => w.enabled).map((w) => w.key),
    [widgets],
  );
  const layoutDirty = useMemo(
    () => JSON.stringify(enabledOrder) !== JSON.stringify(preference.dashboardWidgets),
    [enabledOrder, preference.dashboardWidgets],
  );

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setSigningOut(false);
      error(signOutError.message || "Could not sign out");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  async function handleSaveName() {
    setSavingName(true);
    try {
      await apiPatch("/api/user", { name: name.trim() });
      success("Name updated");
      refresh();
    } catch (e) {
      error(e instanceof ApiError ? e.message : "Could not update name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleDefaultAccount(value: string) {
    setSavingAccount(true);
    try {
      await apiPatch("/api/preferences", { defaultAccountId: value || null });
      success("Saved");
      refresh();
    } catch (e) {
      error(e instanceof ApiError ? e.message : "Could not save default account");
    } finally {
      setSavingAccount(false);
    }
  }

  function toggleWidget(key: WidgetKey) {
    setWidgets((prev) => prev.map((w) => (w.key === key ? { ...w, enabled: !w.enabled } : w)));
  }

  function move(index: number, dir: -1 | 1) {
    setWidgets((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSaveLayout() {
    setSavingLayout(true);
    try {
      await apiPatch("/api/preferences", { dashboardWidgets: enabledOrder });
      success("Dashboard layout saved");
      refresh();
    } catch (e) {
      error(e instanceof ApiError ? e.message : "Could not save layout");
    } finally {
      setSavingLayout(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {/* Profile */}
      <Card>
        <CardHeader title="Profile" subtitle="Your account details." />
        <CardBody className="flex flex-col gap-4">
          <Field label="Name" htmlFor="profile-name">
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameDirty && !savingName) handleSaveName();
                }}
              />
              <Button onClick={handleSaveName} loading={savingName} disabled={!nameDirty} className="shrink-0">
                Save
              </Button>
            </div>
          </Field>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-label-md uppercase text-muted">Email</p>
              <p className="mt-1 truncate text-sm text-fg">{user.email}</p>
            </div>
            <Button
              variant="outline"
              onClick={handleSignOut}
              loading={signingOut}
              className="shrink-0"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader title="Appearance" subtitle="Choose how MyExpense looks." />
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg">Theme — Light / System / Dark</p>
          <ThemeToggle />
        </CardBody>
      </Card>

      {/* Default account */}
      <Card>
        <CardHeader title="Default account" subtitle="Pre-selected when adding new transactions." />
        <CardBody>
          <Field label="Default account" htmlFor="default-account">
            <Select
              id="default-account"
              value={preference.defaultAccountId ?? ""}
              disabled={savingAccount}
              onChange={(e) => handleDefaultAccount(e.target.value)}
            >
              <option value="">No default</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      {/* Dashboard widgets */}
      <Card>
        <CardHeader
          title="Dashboard widgets"
          subtitle="Choose which widgets appear on your dashboard and in what order. Only enabled widgets are shown; reorder them from top to bottom."
          action={
            <Button
              size="sm"
              onClick={handleSaveLayout}
              loading={savingLayout}
              disabled={!layoutDirty}
            >
              Save layout
            </Button>
          }
        />
        <CardBody>
          <ul className="flex flex-col divide-y divide-border rounded-none border border-border">
            {widgets.map((w, i) => (
              <li
                key={w.key}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5",
                  !w.enabled && "opacity-60",
                )}
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label={`Move ${WIDGET_LABELS[w.key]} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="rounded p-0.5 text-faint transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${WIDGET_LABELS[w.key]} down`}
                    disabled={i === widgets.length - 1}
                    onClick={() => move(i, 1)}
                    className="rounded p-0.5 text-faint transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <span className="flex-1 text-sm text-fg">{WIDGET_LABELS[w.key]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={w.enabled}
                  aria-label={WIDGET_LABELS[w.key]}
                  onClick={() => toggleWidget(w.key)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    w.enabled ? "bg-brand" : "bg-border",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-none bg-white shadow-sm transition-transform",
                      w.enabled ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Data & backup */}
      <Card>
        <CardHeader title="Data & backup" subtitle="Your data is always yours — export everything any time." />
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/export?format=json"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-none border border-border bg-surface-2 px-4 text-sm font-medium text-fg transition-colors hover:bg-border/60"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download full backup (JSON)
            </a>
            <a
              href="/api/export?format=csv"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-none border border-border bg-surface-2 px-4 text-sm font-medium text-fg transition-colors hover:bg-border/60"
            >
              <Download className="h-4 w-4" aria-hidden />
              Export transactions (CSV)
            </a>
          </div>
          <div>
            <Link
              href="/import"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-hover hover:underline"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Restore or import data
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
