"use client";
import { createContext, useContext, useEffect, useState } from "react";

const KEY = "sidebar-collapsed";

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
}

const Ctx = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Hydrate the saved preference after mount (keeps SSR markup stable).
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") setCollapsed(true);
    } catch {
      /* storage unavailable — fall back to expanded */
    }
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  return <Ctx.Provider value={{ collapsed, toggle }}>{children}</Ctx.Provider>;
}

export function useSidebar(): SidebarCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
