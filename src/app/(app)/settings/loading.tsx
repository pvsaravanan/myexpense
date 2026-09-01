import { Skeleton } from "@/components/ui/misc";

export default function SettingsLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Profile card skeleton */}
      <div className="space-y-4 rounded-none border border-border bg-surface p-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 w-20" />
        </div>
      </div>

      {/* Appearance card skeleton */}
      <div className="space-y-3 rounded-none border border-border bg-surface p-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full sm:w-64" />
      </div>

      {/* Default account card skeleton */}
      <div className="space-y-3 rounded-none border border-border bg-surface p-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-12 w-full" />
      </div>

      {/* Dashboard widgets card skeleton */}
      <div className="space-y-3 rounded-none border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>

      {/* Data & backup card skeleton */}
      <div className="space-y-3 rounded-none border border-border bg-surface p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-72" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
    </div>
  );
}
