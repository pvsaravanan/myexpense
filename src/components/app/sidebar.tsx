"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Logo } from "@/components/logo";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav-items";
import { useTransactionModal } from "./add-transaction";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const { openAdd } = useTransactionModal();
  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center border-b border-border px-md">
        <Link href="/dashboard" aria-label="MyExpense home">
          <Logo />
        </Link>
      </div>

      <div className="border-b border-border p-sm">
        <button
          onClick={() => openAdd()}
          className="flex h-[41px] w-full items-center justify-center gap-2 rounded-none border border-border bg-brand px-4 text-body-sm font-bold text-brand-fg shadow-stamp transition-all hover:bg-brand-hover hover:-translate-x-px hover:-translate-y-px hover:shadow-stamp-lg active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add transaction
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-sm py-md">
        <p className="mb-xs px-1 text-label-sm uppercase text-faint">Money</p>
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
        <p className="mb-xs mt-md px-1 text-label-sm uppercase text-faint">Setup</p>
        <div className="space-y-0.5">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </nav>

      <div className="border-t border-border px-md py-sm">
        <p className="text-label-sm uppercase leading-relaxed text-faint">
          Know where your
          <br />
          money goes.
        </p>
      </div>
    </aside>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-none border px-2 py-1.5 text-label-md uppercase transition-all active:translate-x-px active:translate-y-px active:shadow-none",
        active
          ? // The current page reads as a coral tile stamped onto the rail.
            "border-border bg-brand text-brand-fg shadow-stamp-sm"
          : "border-transparent text-muted hover:border-border hover:bg-brand-soft hover:text-secondary",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
