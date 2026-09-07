"use client";

import { DownloadIcon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Specs tab: a solid indigo Generate action over spec document cards. Each
// card carries a mono format line (format · revision) — the instrument
// readout voice — so specs read as drafted artifacts, not list rows.
// ---------------------------------------------------------------------------

function SpecsTab() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4">
      <Button variant="default" className="w-full rounded-xl py-2.5 font-medium">
        Generate Spec
      </Button>

      <div className="flex flex-1 flex-col gap-3">
        <div className="rounded-2xl border border-surface-border bg-surface p-4 transition-colors hover:border-subtle-border">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-elevated"
            >
              <FileTextIcon className="h-4 w-4 text-brand" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-medium text-copy-primary">
                  E-commerce Backend Spec
                </h3>
                <Button variant="ghost" size="icon-sm" disabled aria-label="Download spec">
                  <DownloadIcon />
                </Button>
              </div>
              <p className="mt-0.5 font-mono text-[11px] tracking-wide text-copy-faint uppercase">
                Markdown · Draft v1
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-copy-muted">
                API endpoints, data models, and auth flow for a scalable e-commerce backend...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SpecsTab };
