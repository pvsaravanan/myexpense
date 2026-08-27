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
  const { collapsed } = useSidebar();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-[232px]",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-2" : "px-md")}>
        <Link href="/dashboard" aria-label="Baaki home">
          <Logo showText={!collapsed} />
        </Link>
      </div>

      <div className={cn("border-b border-border", collapsed ? "p-2" : "p-sm")}>
        <button
          onClick={() => openAdd()}
          title={collapsed ? "Add transaction" : undefined}
          aria-label="Add transaction"
          className={cn(
            "flex h-[41px] w-full items-center justify-center gap-2 rounded-none border border-border bg-brand text-body-sm font-bold text-brand-fg shadow-stamp transition-all hover:bg-brand-hover hover:-translate-x-px hover:-translate-y-px hover:shadow-stamp-lg active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
            collapsed ? "px-0" : "px-4",
          )}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          {!collapsed && "Add transaction"}
        </button>
      </div>

      <nav className={cn("flex-1 overflow-y-auto py-md", collapsed ? "px-2" : "px-sm")}>
        {collapsed ? <div className="mb-xs" /> : <p className="mb-xs px-1 text-label-sm uppercase text-faint">Money</p>}
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </div>
        {collapsed ? (
          <div className="mt-md" />
        ) : (
          <p className="mb-xs mt-md px-1 text-label-sm uppercase text-faint">Setup</p>
        )}
        <div className="space-y-0.5">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {!collapsed && (
        <div className="border-t border-border px-md py-sm">
          <p className="text-label-sm uppercase leading-relaxed text-faint">
            Know where your
            <br />
            money goes.
          </p>
        </div>
      )}
    </aside>
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
      title={collapsed ? item.label : undefined}
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
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
