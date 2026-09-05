"use client";

import { useEffect, useState } from "react";

import { SHAPE_DRAG_MIME, type ShapeDefinition } from "@/lib/canvas/shape-definitions";

// ---------------------------------------------------------------------------
// Owns the state for the custom drag preview that follows the cursor while a
// shape is being dragged from the bottom shape panel.
//
// The shape panel buttons fire a native HTML5 `dragstart` that writes the
// shape payload to the custom `SHAPE_DRAG_MIME` slot of `dataTransfer`. The
// browser's default ghost image is hidden here (`event.dataTransfer.setData`
// alone is enough — the browser stops drawing its native ghost the moment
// the consumer reads from the dataTransfer and the listener in this hook
// runs). A custom ghost is rendered by `<ShapeDragPreview />`, which reads
// the current `{ shape, x, y }` from this hook.
//
// Why global `document` listeners and not panel-local handlers:
// - The preview is rendered through a portal at `document.body`, so panel-
//   local React state would still need global position updates on every
//   cursor move. The `document` listener is one source of truth.
// - `dragover` fires on every drop target but the browser throttles it
//   outside drop targets; `mousemove` is the safety net so the preview
//   keeps tracking the cursor when the user drags over non-drop chrome
//   (e.g. the navbar or the empty area outside the canvas).
// - `dragend` fires on every drag termination (drop OR Esc) — clearing the
//   state on `dragend` is the documented hook for hiding the ghost.
//
// Position updates are batched to one frame via `requestAnimationFrame` so
// a fast cursor doesn't queue 60+ setStates per second.
// ---------------------------------------------------------------------------

type PreviewState = {
  shape: ShapeDefinition | null;
  x: number;
  y: number;
};

function isShapeDefinition(value: unknown): value is ShapeDefinition {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; width?: unknown; height?: unknown };
  return (
    typeof candidate.name === "string" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number"
  );
}

function useShapeDragPreview(): PreviewState {
  const [state, setState] = useState<PreviewState>({ shape: null, x: 0, y: 0 });

  useEffect(() => {
    let activeShape: ShapeDefinition | null = null;
    let pendingX = 0;
    let pendingY = 0;
    let frame = 0;

    const flush = () => {
      frame = 0;
      if (activeShape === null) return;
      setState({ shape: activeShape, x: pendingX, y: pendingY });
    };

    const queue = (x: number, y: number) => {
      pendingX = x;
      pendingY = y;
      if (frame === 0) frame = requestAnimationFrame(flush);
    };

    const onDragStart = (event: DragEvent) => {
      // Only react to drags from the shape panel — identified by the custom
      // MIME slot the panel writes. Other drags (text selection, files, etc.)
      // are ignored so the preview never appears for unrelated operations.
      const raw = event.dataTransfer?.getData(SHAPE_DRAG_MIME);
      if (!raw) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      if (!isShapeDefinition(parsed)) return;
      activeShape = parsed;
      pendingX = event.clientX;
      pendingY = event.clientY;
      setState({ shape: activeShape, x: pendingX, y: pendingY });
    };

    const onDragOver = (event: DragEvent) => {
      if (activeShape === null) return;
      queue(event.clientX, event.clientY);
    };

    const onMouseMove = (event: MouseEvent) => {
      // Safety net: `dragover` throttles outside drop targets in some
      // browsers. `mousemove` fires everywhere, so it keeps the preview
      // tracking the cursor when the user drags over non-drop chrome.
      if (activeShape === null) return;
      queue(event.clientX, event.clientY);
    };

    const onDragEnd = () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      activeShape = null;
      setState({ shape: null, x: 0, y: 0 });
    };

    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("dragend", onDragEnd);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("dragend", onDragEnd);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}

export { useShapeDragPreview };
export type { PreviewState };
