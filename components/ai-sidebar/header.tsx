"use client";

import { SparklesIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Sidebar header: Ghost glyph tile (indigo wash + glow) + title block with a
// live-drafting status line, close button right. The mono status line is the
// sidebar's instrument readout — quiet, technical, always true.
// ---------------------------------------------------------------------------

export type AISidebarHeaderProps = {
  onClose: () => void;
};

function AISidebarHeader({ onClose }: AISidebarHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-subtle-border bg-elevated"
        >
          <SparklesIcon className="h-4 w-4 text-brand" />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold tracking-tight text-copy-primary">
            Ghost Architect
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-copy-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Drafting with you
          </span>
        </div>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close AI sidebar">
        <XIcon />
      </Button>
    </div>
  );
}

export { AISidebarHeader };
