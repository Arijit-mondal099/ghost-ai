"use client";

import { useReactFlow } from "@xyflow/react";
import { useCanRedo, useCanUndo, useRedo, useUndo } from "@liveblocks/react";
import { Maximize2, Redo2, Undo2, ZoomIn, ZoomOut } from "lucide-react";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { type CanvasEdge, type CanvasNode } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Floating zoom + history control bar for the collaborative canvas.
//
// A pill rendered at the bottom-left of the canvas surface, sibling of
// `<ShapePanel />`, `<ShapeDragPreview />`, and `<CanvasColorToolbar />`.
// Two groups — zoom (out / fit / in) and history (undo / redo) — separated
// by a thin divider. The same chrome family as the top delete pill at
// `canvas-room.tsx:117-128` and the bottom shape panel, so all four
// overlays read as a single design system.
//
// `nodrag` / `nopan` on the root opt the pill out of React Flow's
// drag/pan gestures — the same opt-out the color toolbar uses
// (`canvas-color-toolbar.tsx:108`). Without these classes a click on a
// button would also start a node drag.
//
// Undo / redo go through `useUndo` / `useRedo` from `@liveblocks/react`,
// which is the same history stack the Liveblocks Storage mutations in
// `useCanvasDrop`, `useCanvasLabelEdit`, and the color/edge-label edit
// hooks already write into. The keyboard handler in
// `hooks/use-keyboard-shortcuts.ts` receives the same `undo` / `redo`
// functions so the keyboard and pointer paths cannot drift apart.
//
// `useCanUndo` / `useCanRedo` drive the `disabled` attribute; the buttons
// stay rendered so their position is stable, but they are visually
// dimmed and refuse pointer events. The `useKeyboardShortcuts` hook does
// NOT consult these flags — pressing the shortcut when the history is
// empty is a Liveblocks no-op, so guarding at the button layer is
// sufficient.
//
// Spec: .claude/context/specs/17-canvas-ergonomics.md
// ---------------------------------------------------------------------------

const iconButtonClassName =
  "nodrag nopan flex h-7 w-7 items-center justify-center rounded-full text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-copy-secondary";

const ZOOM_DURATION_MS = 200;

function CanvasControlBar() {
  const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();
  const undo = useUndo();
  const redo = useRedo();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  // Wires the same actions to the spec's keyboard shortcuts. Must run on
  // every render — keyboard hookup is unconditional, even when buttons
  // are disabled.
  useKeyboardShortcuts({ reactFlow, onUndo: undo, onRedo: redo });

  return (
    <div
      role="toolbar"
      aria-label="Canvas controls"
      className="nodrag nopan absolute bottom-6 left-6 z-40 flex items-center gap-1 rounded-full border border-surface-border bg-elevated/95 px-2 py-1.5 shadow-lg backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() => reactFlow.zoomOut({ duration: ZOOM_DURATION_MS })}
        title="Zoom out (-)"
        aria-label="Zoom out"
        className={iconButtonClassName}
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => reactFlow.fitView({ duration: ZOOM_DURATION_MS, padding: 0.1 })}
        title="Fit view"
        aria-label="Fit view"
        className={iconButtonClassName}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => reactFlow.zoomIn({ duration: ZOOM_DURATION_MS })}
        title="Zoom in (+)"
        aria-label="Zoom in"
        className={iconButtonClassName}
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-4 w-px bg-surface-border" />

      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        className={iconButtonClassName}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
        aria-label="Redo"
        className={iconButtonClassName}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export { CanvasControlBar };
