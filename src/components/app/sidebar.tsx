"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Logo } from "@/components/logo";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav-items";
import { useTransactionModal } from "./add-transaction";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const { openAdd } = useTransactionModal();
  const { collapsed, toggle } = useSidebar();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-300 ease-out md:flex relative",
        collapsed ? "w-[68px]" : "w-[232px]",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-border transition-all duration-300 ease-out",
          collapsed ? "justify-center px-1" : "px-md",
        )}
      >
        <Link href="/dashboard" aria-label="baaki home" title="Dashboard">
          <Logo size={collapsed ? "h-7 w-7" : "h-9 w-9"} />
        </Link>
      </div>

      <div className={cn("border-b border-border transition-all duration-300 ease-out", collapsed ? "p-2" : "p-sm")}>
        <button
          onClick={() => openAdd()}
          title="Add transaction"
          aria-label="Add transaction"
          className={cn(
            "flex h-[41px] w-full items-center justify-center gap-2 rounded-none border border-border bg-brand text-body-sm font-bold text-brand-fg shadow-stamp transition-all hover:bg-brand-hover hover:-translate-x-px hover:-translate-y-px hover:shadow-stamp-lg active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
            collapsed ? "px-0" : "px-4",
          )}
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out",
              collapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100",
            )}
          >
            Add transaction
          </span>
        </button>
      </div>

      <nav className={cn("flex-1 overflow-y-auto py-md transition-all duration-300 ease-out", collapsed ? "px-2" : "px-sm")}>
        <SectionLabel label="Money" collapsed={collapsed} />
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </div>
        <SectionLabel label="Setup" collapsed={collapsed} className="mt-md" />
        <div className="space-y-0.5">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      <div
        className={cn(
          "overflow-hidden border-t border-border transition-[max-height,opacity,padding] duration-300 ease-out",
          collapsed ? "max-h-0 opacity-0 px-0 py-0" : "max-h-24 opacity-100 px-md py-sm",
        )}
      >
        <p className="text-label-sm uppercase leading-relaxed text-faint">
          Know where your
          <br />
          money goes.
        </p>
      </div>

      {/* Right-edge handle — hover the border to reveal, click to toggle. */}
      <button
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute right-0 top-0 z-10 h-full w-[4px] cursor-pointer bg-transparent transition-colors hover:bg-brand"
      />
    </aside>
  );
}

function SectionLabel({ label, collapsed, className }: { label: string; collapsed: boolean; className?: string }) {
  return (
    <p
      className={cn(
        "mb-xs overflow-hidden whitespace-nowrap px-1 text-label-sm uppercase text-faint transition-[max-width,opacity,margin] duration-300 ease-out",
        collapsed ? "max-w-0 opacity-0 mb-0" : "max-w-[180px] opacity-100",
        className,
      )}
    >
      {label}
    </p>
  );
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex items-center rounded-none border py-1.5 text-label-md uppercase transition-all active:translate-x-px active:translate-y-px active:shadow-none",
        collapsed ? "justify-center px-0" : "gap-2.5 px-2",
        active
          ? // The current page reads as a coral tile stamped onto the rail.
            "border-border bg-brand text-brand-fg shadow-stamp-sm"
          : "border-transparent text-muted hover:border-border hover:bg-brand-soft hover:text-secondary",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      <span
        className={cn(
          "truncate overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out",
          collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100",
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}
