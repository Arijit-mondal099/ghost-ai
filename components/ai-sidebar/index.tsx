"use client";

import { AISidebarHeader } from "./header";
import { AISidebarTabs } from "./tabs";
import type { AISidebarProps } from "./constants";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Floating AI sidebar — slides in from the right edge of the canvas view.
// Open/close state is controlled by the parent via `isOpen` / `onClose`.
// Surface: base/95 + backdrop blur with a flat hairline left border. Width
// stays `w-80` — the workspace client reserves exactly `pr-80` for it.
// ---------------------------------------------------------------------------

function AISidebar({ isOpen, onClose, projectId, roomId }: AISidebarProps) {
  return (
    <aside
      inert={!isOpen}
      aria-hidden={!isOpen}
      className={cn(
        "fixed right-0 top-14 bottom-0 z-40 flex w-80 flex-col border-l border-surface-border bg-base/95 backdrop-blur-md transition-transform duration-200",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
    >
      <AISidebarHeader onClose={onClose} />
      <AISidebarTabs projectId={projectId} roomId={roomId} />
    </aside>
  );
}

export { AISidebar };
export type { AISidebarProps } from "./constants";
