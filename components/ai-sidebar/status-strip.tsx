"use client";

import { DraftingDots } from "@/components/loading";
import { useRunClock } from "@/hooks/use-run-clock";

// ---------------------------------------------------------------------------
// Architect run status, docked directly above the chat composer. Rendered
// only while a design run is active — it mounts and unmounts with the run,
// never lingers, so the run clock reads run time with no timestamp plumbing.
//
// Ghost eyebrow in the AI token (same voice as the Ghost chat annotation),
// node-dot drafting pulse instead of a generic spinner, the latest
// `AI_STATUS` message truncated to one line, and an honest elapsed clock in
// mono — runs take minutes, and the clock says so. The clock is `aria-hidden`
// so the ticking never spams screen readers; `aria-live` announces status
// text changes without moving focus.
// ---------------------------------------------------------------------------

export type StatusStripProps = {
  message: string | null;
};

function StatusStrip({ message }: StatusStripProps) {
  const elapsed = useRunClock();

  return (
    <div aria-live="polite" className="border-t border-surface-border bg-base px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <DraftingDots className="text-ai-text" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-widest text-ai-text uppercase">
            Ghost is drafting
          </p>
          <p className="truncate text-xs text-copy-secondary">
            {message ?? "Working the blueprint…"}
          </p>
        </div>
        <span aria-hidden="true" className="shrink-0 font-mono text-[11px] text-copy-faint">
          {elapsed}
        </span>
      </div>
    </div>
  );
}

export { StatusStrip };
