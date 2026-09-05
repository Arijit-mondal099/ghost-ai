"use client";

import { useEffect } from "react";
import { type ReactFlowInstance } from "@xyflow/react";

import { type CanvasEdge, type CanvasNode } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Window-level keyboard shortcuts for the collaborative canvas.
//
// Mirrors the editable-field skip established by `useCanvasDelete`: any
// keystroke that lands inside `input`, `textarea`, or a contentEditable
// surface passes through unmodified, so node/edge label editing and the
// navbar search are unaffected by the global listener.
//
// Shortcuts implemented here are the same actions the bottom-left control
// bar exposes (zoom in / out / fit, undo, redo) — the hook receives the
// React Flow instance and the undo/redo callbacks as args so the two input
// paths (keyboard and pointer) cannot drift apart. The instance is nullable
// because `useReactFlow()` returns a getter-backed ref; if the caller
// invokes this hook before the provider has resolved, the zoom actions
// silently no-op rather than throwing.
//
// Spec: .claude/context/specs/17-canvas-ergonomics.md
// ---------------------------------------------------------------------------

type UseKeyboardShortcutsArgs = {
  reactFlow: ReactFlowInstance<CanvasNode, CanvasEdge> | null;
  onUndo: () => void;
  onRedo: () => void;
};

function useKeyboardShortcuts({ reactFlow, onUndo, onRedo }: UseKeyboardShortcutsArgs) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      // `isContentEditable` covers `contenteditable=""` and
      // `plaintext-only` too, unlike `[contenteditable="true"]`.
      if (target?.isContentEditable) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // Zoom in — accept both `+` (Shift+= on a US layout) and `=`.
      if (!mod && (event.key === "+" || event.key === "=")) {
        reactFlow?.zoomIn({ duration: 200 });
        event.preventDefault();
        return;
      }
      // Zoom out.
      if (!mod && event.key === "-") {
        reactFlow?.zoomOut({ duration: 200 });
        event.preventDefault();
        return;
      }
      // Undo.
      if (mod && !event.shiftKey && key === "z") {
        onUndo();
        event.preventDefault();
        return;
      }
      // Redo — Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y.
      if ((mod && event.shiftKey && key === "z") || (mod && key === "y")) {
        onRedo();
        event.preventDefault();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reactFlow, onUndo, onRedo]);
}

export { useKeyboardShortcuts };
export type { UseKeyboardShortcutsArgs };
