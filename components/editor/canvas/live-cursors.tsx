"use client";

import { useEffect, useState } from "react";
import { useViewport } from "@xyflow/react";
import { useOthers } from "@liveblocks/react";
import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Live remote cursors overlay for the collaborative canvas.
//
// Reads `useOthers` and renders one small colored pointer + name badge per
// other participant whose presence `cursor` is non-null. Presence `cursor`
// is broadcast in flow coordinates (see `usePresenceCursor`), so each
// cursor is positioned by converting flow -> screen with the live viewport.
// The round-trip survives pan/zoom — the cursor floats with the node under
// it instead of sticking to a fixed screen position.
//
// `pointer-events-none` so the cursor layer never blocks clicks/drags.
// `z-30` keeps the cursors below the in-canvas chrome (`z-40`) but above
// the React Flow surface (default). The canvas surface's outer `relative`
// wrapper is the positioning context.
//
// SSR safety: `useViewport` and `useOthers` both need a real DOM, so the
// first render returns null and `useEffect` flips the flag on the next
// tick. Same pattern as `canvas-color-toolbar.tsx:70-73` and
// `shape-drag-preview.tsx:120-125`.
// ---------------------------------------------------------------------------

const CURSOR_OFFSET_X = -2;
const CURSOR_OFFSET_Y = -2;

function LiveCursors() {
  const others = useOthers();
  const { x: vx, y: vy, zoom } = useViewport();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const visible = others.filter((other) => other.presence?.cursor !== null);

  if (visible.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {visible.map((other) => {
        const cursor = other.presence?.cursor;
        if (!cursor) return null;
        const screenX = cursor.x * zoom + vx;
        const screenY = cursor.y * zoom + vy;
        const name = other.info?.name?.trim() || "Anonymous";
        const color = other.info?.color || "#52A8FF";
        // Existing `Presence.isThinking` contract (spec 25): spinner shows only
        // when true; false or missing stays a plain name badge.
        const thinking = other.presence?.isThinking === true;
        return (
          <div
            key={other.connectionId}
            className="absolute"
            style={{
              left: screenX,
              top: screenY,
              transform: `translate(${CURSOR_OFFSET_X}px, ${CURSOR_OFFSET_Y}px)`,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M3 2 L17 9 L10 11 L8 18 Z"
                fill={color}
                stroke="var(--bg-base)"
                strokeWidth="1.25"
                strokeLinejoin="round"
              />
            </svg>
            <div
              className={cn(
                "absolute top-4 left-4 flex items-center gap-1 whitespace-nowrap rounded-md border border-surface-border px-1.5 py-0.5 text-[10px] font-medium text-copy-primary",
              )}
              style={{
                background: color,
                boxShadow: "0 0 0 2px var(--accent-primary-dim)",
              }}
            >
              {thinking ? <LoaderCircleIcon aria-hidden className="h-3 w-3 animate-spin" /> : null}
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { LiveCursors };
