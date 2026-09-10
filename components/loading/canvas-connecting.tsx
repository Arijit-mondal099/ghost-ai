"use client";

import { LoaderCircleIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Signature loading state: the canvas connects like a schematic being drawn.
// Three dashed node silhouettes (rectangle / pill / cylinder echoes of the
// canvas shape vocabulary) breathe at staggered delays while a slow warm-cream
// sweep travels across them — drafting, not buffering. Everything else in the
// app stays quiet (plain pulse blocks + lucide spinners); this is the one
// memorable loader.
// ---------------------------------------------------------------------------

function CanvasConnecting({ label = "Connecting to canvas" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{
        background: "var(--bg-base)",
        backgroundImage: "radial-gradient(var(--text-faint) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <div className="relative flex flex-col items-center gap-5 px-6">
        <div aria-hidden="true" className="relative flex items-center gap-3">
          {/* Sweep: warm-cream light pass, clipped to the drafting row. */}
          <span className="ghost-draft-sweep pointer-events-none absolute inset-y-[-8px] inset-x-[-24px]" />
          <span
            className="h-14 w-24 animate-pulse rounded-lg border border-dashed border-subtle-border bg-surface motion-reduce:animate-none"
            style={{ animationDelay: "0ms" }}
          />
          <span
            aria-hidden="true"
            className="h-px w-8 border-t border-dashed border-subtle-border"
          />
          <span
            className="h-14 w-24 animate-pulse rounded-full border border-dashed border-subtle-border bg-surface motion-reduce:animate-none"
            style={{ animationDelay: "350ms" }}
          />
          <span
            aria-hidden="true"
            className="h-px w-8 border-t border-dashed border-subtle-border"
          />
          <span
            className="h-14 w-20 animate-pulse rounded-xl border border-dashed border-subtle-border bg-surface motion-reduce:animate-none"
            style={{ animationDelay: "700ms" }}
          />
        </div>
        <p className="flex items-center gap-2 rounded-full border border-surface-border bg-elevated/95 px-3.5 py-1.5 shadow-lg backdrop-blur-md">
          <LoaderCircleIcon
            aria-hidden="true"
            className="h-4 w-4 animate-spin text-brand motion-reduce:animate-none"
          />
          <span className="font-mono text-xs tracking-wide text-copy-secondary">
            {label} &mdash; drafting&hellip;
          </span>
        </p>
      </div>
    </div>
  );
}

export { CanvasConnecting };
