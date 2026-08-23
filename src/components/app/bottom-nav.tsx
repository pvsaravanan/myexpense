"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, LayoutDashboard, MoreHorizontal, PieChart, Plus } from "lucide-react";
import { Sheet } from "./sheet";
import { ALL_NAV } from "./nav-items";
import { useTransactionModal } from "./add-transaction";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PieChart },
];

export function BottomNav() {
  const pathname = usePathname();
  const { openAdd } = useTransactionModal();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-surface/95 backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-2 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
          <Tab {...TABS[0]} active={isActive(TABS[0].href)} />
          <Tab {...TABS[1]} active={isActive(TABS[1].href)} />
          <div className="flex justify-center">
            <button
              onClick={() => openAdd()}
              aria-label="Add transaction"
              className="-mt-5 flex h-13 w-13 items-center justify-center rounded-none border-2 border-border bg-brand text-brand-fg shadow-stamp transition-all hover:shadow-stamp-lg active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>
          <Tab {...TABS[2]} active={isActive(TABS[2].href)} />
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center gap-1 py-1.5 text-label-sm uppercase active:opacity-70",
              moreOpen ? "text-brand-hover" : "text-muted",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
        <div className="grid grid-cols-3 gap-2 pb-2">
          {ALL_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-none border border-border p-4 text-label-sm uppercase transition-all active:translate-x-px active:translate-y-px active:shadow-none",
                  active ? "bg-brand text-brand-fg shadow-stamp-sm" : "text-muted hover:bg-brand-soft hover:text-secondary",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn("flex flex-col items-center gap-1 py-2 text-label-sm uppercase", active ? "text-brand-hover" : "text-muted")}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
      {label}
    </Link>
  );
}
