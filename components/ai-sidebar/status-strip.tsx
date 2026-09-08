"use client";

import { LoaderCircleIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Compact active-run status bar, docked directly above the chat composer.
// Rendered only while a design run is active — it mounts and unmounts with
// the run, never lingers. Dark base with a success-token indicator; the text
// is the latest `AI_STATUS` message, truncated to one line. `aria-live`
// keeps screen readers posted without moving focus.
// ---------------------------------------------------------------------------

export type StatusStripProps = {
  message: string | null;
};

function StatusStrip({ message }: StatusStripProps) {
  return (
    <div aria-live="polite" className="border-t border-surface-border bg-base px-4 py-2">
      <p className="flex items-center gap-2 text-xs">
        <LoaderCircleIcon
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 animate-spin text-success motion-reduce:animate-none"
        />
        <span className="min-w-0 flex-1 truncate text-copy-secondary">
          {message ?? "Ghost is drafting…"}
        </span>
      </p>
    </div>
  );
}

export { StatusStrip };
