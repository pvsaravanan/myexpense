"use client";
import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { useSidebar } from "./sidebar-context";

export function Topbar() {
  const { collapsed, toggle } = useSidebar();
  return (
    <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top,0px))] items-center justify-between border-b border-border bg-bg/95 backdrop-blur-sm px-4 pt-[env(safe-area-inset-top,0px)] sm:px-6">
      <div className="md:hidden">
        <Link href="/dashboard" aria-label="baaki home">
          <Logo />
        </Link>
      </div>
      <button
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="hidden h-9 w-9 items-center justify-center rounded-none text-muted transition-colors hover:bg-surface-2 hover:text-fg md:flex"
      >
        <PanelLeft className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
