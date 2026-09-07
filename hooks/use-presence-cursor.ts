"use client";

import { useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useSelf, useUpdateMyPresence } from "@liveblocks/react";

import type { CanvasEdge, CanvasNode } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Mouse-driven Liveblocks presence cursor for the canvas surface.
//
// Returns the two DOM event handlers that the canvas surface's outer
// `relative` wrapper spreads alongside `useCanvasDrop`'s handlers. Each
// mousemove is converted from screen to flow coordinates (the same
// `useReactFlow().screenToFlowPosition` helper the drop hook uses) and
// written into the room presence as `{ cursor: { x, y } }`. Mouse leave
// clears it to `null` so renderers can show a "left the canvas" indicator
// without a sentinel coordinate.
//
// Throttled to ~30 Hz (one update per ~33 ms). The Liveblocks presence
// channel is broadcast on every patch, and a per-pixel mousemove would
// saturate the websocket for no visible gain — the human eye reads cursor
// position at ~30 Hz.
//
// `isThinking` is preserved across updates by spreading the current
// presence on each patch.
//
// Hook is unconditional (rules of hooks).
// ---------------------------------------------------------------------------

const CURSOR_THROTTLE_MS = 33;

type PresenceCursorHandlers = {
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
};

function usePresenceCursor(): PresenceCursorHandlers {
  const { screenToFlowPosition } = useReactFlow<CanvasNode, CanvasEdge>();
  const updateMyPresence = useUpdateMyPresence();
  const self = useSelf();
  const lastWriteAt = useRef(0);

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const now = performance.now();
      if (now - lastWriteAt.current < CURSOR_THROTTLE_MS) return;
      lastWriteAt.current = now;

      const { x, y } = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      updateMyPresence({
        cursor: { x, y },
        isThinking: self?.presence?.isThinking ?? false,
      });
    },
    [screenToFlowPosition, updateMyPresence, self?.presence?.isThinking],
  );

  const onMouseLeave = useCallback(() => {
    updateMyPresence({
      cursor: null,
      isThinking: self?.presence?.isThinking ?? false,
    });
  }, [updateMyPresence, self?.presence?.isThinking]);

  return { onMouseMove, onMouseLeave };
}

export { usePresenceCursor };
export type { PresenceCursorHandlers };
