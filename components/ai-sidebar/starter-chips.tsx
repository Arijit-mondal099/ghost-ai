"use client";

import { ArrowUpRightIcon } from "lucide-react";

import { STARTER_PROMPTS } from "./constants";

// ---------------------------------------------------------------------------
// Starter drafts shown under the blank-blueprint empty state. Schematic rows
// (not pills): full-width surface strips with an outgoing arrow — each one
// reads as a trace leading off the sheet and onto the canvas.
// ---------------------------------------------------------------------------

export type StarterChipsProps = {
  onSelect?: (prompt: string) => void;
};

function StarterChips({ onSelect }: StarterChipsProps) {
  return (
    <ul className="flex list-none flex-col gap-2 p-0" aria-label="Starter drafts">
      {STARTER_PROMPTS.map((prompt) => (
        <li key={prompt}>
          <button
            type="button"
            onClick={() => onSelect?.(prompt)}
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-left text-[13px] text-copy-secondary transition-colors outline-none hover:border-subtle-border hover:text-copy-primary focus-visible:border-subtle-border"
          >
            <span className="min-w-0 truncate">{prompt}</span>
            <ArrowUpRightIcon className="h-4 w-4 shrink-0 text-copy-faint transition-colors group-hover:text-brand" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export { StarterChips };
