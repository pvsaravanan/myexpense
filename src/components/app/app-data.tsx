"use client";
import { createContext, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import type { AccountDTO, CategoryDTO, PreferenceDTO, TagDTO } from "@/lib/types";

export interface AppData {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  tags: TagDTO[];
  preference: PreferenceDTO;
  /** Re-fetch server components and revalidate client SWR data in real time. */
  refresh: () => void;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({
  value,
  children,
}: {
  value: Omit<AppData, "refresh">;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const refresh = useCallback(() => {
    // 1. Revalidate all active SWR hooks (transactions, summaries, etc.) IN
    //    PLACE. Passing `undefined` as the data cleared every cache entry first,
    //    which threw away any optimistic update and could flash a loading state;
    //    a matcher-only mutate re-fetches while keeping the current values shown.
    mutate(() => true);
    // 2. Re-render the RSC tree for the current route (server-rendered tiles).
    router.refresh();
  }, [mutate, router]);

  return (
    <AppDataContext.Provider value={{ ...value, refresh }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

/** Convenience lookups. */
export function useLookups() {
  const { accounts, categories } = useAppData();
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";
  const category = (id: string | null) => categories.find((c) => c.id === id) ?? null;
  return { accountName, category };
}
