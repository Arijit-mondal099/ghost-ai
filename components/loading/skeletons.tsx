"use client";

import { Skeleton } from "@/components/loading/skeleton";

// ---------------------------------------------------------------------------
// Composed skeletons. Each mirrors the geometry of the content it replaces
// (same radii, same row structure) so mounting content causes no layout
// shift. All blocks are `aria-hidden`; the parent owns the single
// `role="status"` + screen-reader label.
// ---------------------------------------------------------------------------

function SpecListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-2xl border border-surface-border bg-surface p-4"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-3.5 w-2/5 rounded-md" />
            <Skeleton className="h-2.5 w-3/5 rounded-md opacity-70" />
          </div>
          <Skeleton className="h-8 w-8 shrink-0 rounded-xl opacity-70" />
        </div>
      ))}
    </div>
  );
}

function SpecPreviewSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 py-1">
      <Skeleton className="h-5 w-1/3 rounded-md" />
      <Skeleton className="h-3 w-full rounded-md" />
      <Skeleton className="h-3 w-full rounded-md opacity-80" />
      <Skeleton className="h-3 w-4/5 rounded-md opacity-80" />
      <Skeleton className="h-3 w-2/5 rounded-md" />
      <Skeleton className="h-24 w-full rounded-2xl opacity-80" />
      <Skeleton className="h-3 w-3/5 rounded-md opacity-60" />
    </div>
  );
}

function CollaboratorListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex min-w-0 items-center gap-3 border-b border-surface-border px-2 py-1.5 last:border-b-0"
        >
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-1/2 rounded-md" />
            <Skeleton className="h-2.5 w-2/3 rounded-md opacity-60" />
          </div>
          <Skeleton className="h-6 w-6 shrink-0 rounded-lg opacity-60" />
        </div>
      ))}
    </div>
  );
}

export { CollaboratorListSkeleton, SpecListSkeleton, SpecPreviewSkeleton };
