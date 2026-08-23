"use client";
import { useEffect, useRef } from "react";
import { apiPost } from "@/lib/http";
import { useAppData } from "./app-data";

/**
 * Posts any due auto-post recurring rules once per page load, then refreshes so
 * balances reflect them. Deliberately client-side: doing this during a server
 * render meant a write on every render (including RSC prefetches).
 */
export function RunDueRecurring() {
  const { refresh } = useAppData();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    apiPost<{ posted: number }>("/api/recurring/run-due")
      .then((res) => {
        // Use the app-wide refresh (revalidates SWR caches AND the RSC tree),
        // not just router.refresh() — otherwise a user sitting on the
        // transactions list sees a stale list/total after an auto-post.
        if (res?.posted > 0) refresh();
      })
      .catch(() => {
        /* non-critical: the user can still add transactions manually */
      });
  }, [refresh]);

  return null;
}
