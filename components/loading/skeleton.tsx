"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Base skeleton block. Quiet by design: elevated fill + pulse, no shimmer.
// Shaped by the caller (width/height/rounding) so each skeleton mirrors the
// content it replaces and loading never shifts layout. Motion is disabled
// under `motion-reduce` via the caller's `motion-reduce:animate-none`.
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse bg-elevated motion-reduce:animate-none", className)}
    />
  );
}

export { Skeleton };
