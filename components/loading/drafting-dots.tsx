"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Drafting dots: the shared "work is happening" pulse for Ghost runs. Three
// node-dots light left→right in sequence, like nodes being placed on the
// blueprint — the same node-dot language as the Ghost chat rail and the
// canvas connecting loader. Color comes from the parent via
// `currentColor` (`text-ai-text` for Architect runs, `text-brand` for spec
// runs). Static under reduced motion (see `ghost-node-blink`).
// ---------------------------------------------------------------------------

function DraftingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex shrink-0 items-center gap-1", className)}>
      <span className="ghost-node-dot h-1.5 w-1.5 rounded-full bg-current" />
      <span className="ghost-node-dot h-1.5 w-1.5 rounded-full bg-current" />
      <span className="ghost-node-dot h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

export { DraftingDots };
