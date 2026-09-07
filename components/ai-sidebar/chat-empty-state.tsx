"use client";

import { SparklesIcon } from "lucide-react";

import { StarterChips } from "./starter-chips";
import type { StarterChipsProps } from "./starter-chips";

// ---------------------------------------------------------------------------
// Empty state for the Architect chat: a blank blueprint sheet — dashed
// border, drafting corner ticks, mono eyebrow — with the Ghost glyph glowing
// at its center. An empty screen is an invitation to act, so the sheet leads
// straight into starter drafts.
// ---------------------------------------------------------------------------

function CornerTick({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={`absolute h-3 w-3 border-subtle-border ${className}`} />
  );
}

export type ChatEmptyStateProps = StarterChipsProps;

function ChatEmptyState({ onSelect }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-1 flex-col justify-center px-4 py-6">
      <div className="relative rounded-2xl border border-dashed border-subtle-border bg-surface/60 px-5 pt-6 pb-5 text-center">
        <CornerTick className="top-2 left-2 border-t border-l" />
        <CornerTick className="top-2 right-2 border-t border-r" />
        <CornerTick className="bottom-2 left-2 border-b border-l" />
        <CornerTick className="right-2 bottom-2 border-b border-r" />
        <p className="font-mono text-[11px] tracking-widest text-copy-faint uppercase">
          Blank blueprint
        </p>
        <span
          aria-hidden="true"
          className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-subtle-border bg-elevated"
        >
          <SparklesIcon className="h-5 w-5 text-brand" />
        </span>
        <p className="mt-4 text-sm font-medium text-copy-primary">
          Describe the system, Ghost drafts it
        </p>
        <p className="mt-1 text-xs leading-relaxed text-copy-muted">
          Pick a starter draft or write your own — it lands on the canvas.
        </p>
      </div>
      <div className="mt-4">
        <StarterChips onSelect={onSelect} />
      </div>
    </div>
  );
}

export { ChatEmptyState };
