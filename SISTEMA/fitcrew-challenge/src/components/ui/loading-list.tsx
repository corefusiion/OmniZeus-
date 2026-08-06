import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton rows sized like an avatar + two text lines. */
export function LoadingList({ count = 4 }: { count?: number }) {
  return (
    <ul
      className="space-y-2"
      role="status"
      aria-live="polite"
      aria-label="Carregando"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Larger card skeleton, sized like a challenge/feed card. */
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <ul
      className="space-y-3"
      role="status"
      aria-live="polite"
      aria-label="Carregando"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </li>
      ))}
    </ul>
  );
}
