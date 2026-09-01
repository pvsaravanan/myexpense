"use client";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top,0px))] items-center justify-between border-b border-border bg-bg/95 backdrop-blur-sm px-4 pt-[env(safe-area-inset-top,0px)] sm:px-6">
      <div className="md:hidden">
        <Link href="/dashboard" aria-label="baaki home">
          <Logo />
        </Link>
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <UserMenu />
      </div>
    </header>
  );
}
