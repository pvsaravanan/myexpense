"use client";
import { usePathname } from "next/navigation";

/**
 * A single, restrained entrance for page content: on each navigation the
 * content rises and fades in (see the `enter` animation). Keyed by pathname so
 * it replays per route. Respects prefers-reduced-motion via the global reset.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-enter">
      {children}
    </div>
  );
}
