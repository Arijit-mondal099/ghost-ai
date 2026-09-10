"use client";

import { AlertTriangleIcon, CheckIcon, LoaderCircleIcon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CanvasSaveStatus } from "@/hooks/use-canvas-autosave";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Navbar Save button with autosave status (spec 21).
//
// Presentational: the workspace client owns `status` (reported up from the
// in-canvas autosave hook, which lives inside `RoomProvider` where the graph
// exists) and bumps a version counter on click for an immediate save.
// ---------------------------------------------------------------------------

type CanvasSaveButtonProps = {
  status: CanvasSaveStatus;
  onSave: () => void;
};

function CanvasSaveButton({ status, onSave }: CanvasSaveButtonProps) {
  const Icon =
    status === "saving"
      ? LoaderCircleIcon
      : status === "saved"
        ? CheckIcon
        : status === "error"
          ? AlertTriangleIcon
          : SaveIcon;
  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Retry"
          : "Save";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onSave}
      disabled={status === "saving"}
      aria-label={status === "error" ? "Retry canvas save" : "Save canvas now"}
      title={status === "error" ? "Save failed — click to retry" : "Save canvas now"}
      className={cn(status === "error" && "text-destructive")}
    >
      <Icon
        className={cn("h-4 w-4", status === "saving" && "animate-spin motion-reduce:animate-none")}
      />
      {label}
    </Button>
  );
}

export { CanvasSaveButton };
export type { CanvasSaveButtonProps };
