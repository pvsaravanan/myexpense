import { cn } from "@/lib/cn";

/**
 * Baaki wordmark. The mark is deliberately pixel-art: a stepped ascending
 * bar chart drawn on a 12×12 grid with crisp edges, echoing the system's
 * square, zine-like character.
 */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-none text-brand"
      >
        <svg viewBox="0 0 12 12" className="h-[22px] w-[22px]" fill="currentColor" shapeRendering="crispEdges">
          <rect x="1" y="7" width="2" height="4" />
          <rect x="4" y="5" width="2" height="6" />
          <rect x="7" y="2" width="2" height="9" />
        </svg>
      </span>
      {showText && (
        <span className="text-label-lg uppercase tracking-[0.04em] text-fg">
          Ba<span className="text-brand-hover">aki</span>
        </span>
      )}
    </span>
  );
}
