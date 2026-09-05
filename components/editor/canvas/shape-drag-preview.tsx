"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useShapeDragPreview } from "@/hooks/use-shape-drag-preview";
import { NODE_COLORS } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Custom drag preview that follows the cursor while a shape is being dragged
// from the bottom shape panel. Mirrors the silhouette of the eventual dropped
// node so the user can see exactly what will land.
//
// The preview is rendered through a portal at `document.body` so it is not
// clipped by the shape panel's stacking context (`bg-elevated/95
// backdrop-blur-md` would otherwise paint over it). It is also
// `pointer-events-none` so it never intercepts the drop target on the canvas
// wrapper — the `dragover`/`drop` events on the canvas still see the cursor
// directly.
//
// The render is intentionally a *copy* of the node renderer's shape code
// (CSS radii + inline SVG paths) rather than a shared helper. Two consumers
// with ~20 lines of visual constants is below the bar for extraction; the
// `canvas-node.tsx` renderer stays the single source of truth for the
// *interactive* node, and this preview is its stateless visual echo. A
// change to the shape vocabulary is two edits, not a refactor.
//
// The shape is always rendered with the neutral `NODE_COLORS[0]` fill and
// `--border-default` border at 50% opacity — the goal is a "ghost", not a
// pre-selected node. The actual dropped node will use the same neutral
// default (the drop hook sets `color: DEFAULT_NODE_COLOR`).
// ---------------------------------------------------------------------------

const PREVIEW_BORDER = "var(--border-default)";
const PREVIEW_FILL = NODE_COLORS[0].fill;

const CSS_SHAPE_RADIUS: Record<string, string> = {
  rectangle: "12px",
  circle: "50%",
  pill: "9999px",
};

function ShapeSilhouette({
  shapeName,
  width,
  height,
}: {
  shapeName: string;
  width: number;
  height: number;
}) {
  if (shapeName === "rectangle" || shapeName === "circle" || shapeName === "pill") {
    return (
      <div
        style={{
          width,
          height,
          background: PREVIEW_FILL,
          border: `1.5px solid ${PREVIEW_BORDER}`,
          borderRadius: CSS_SHAPE_RADIUS[shapeName],
        }}
      />
    );
  }

  return (
    <svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {shapeName === "diamond" && (
        <polygon
          points="50,0 100,50 50,100 0,50"
          fill={PREVIEW_FILL}
          stroke={PREVIEW_BORDER}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      )}
      {shapeName === "hexagon" && (
        <polygon
          points="25,0 75,0 100,50 75,100 25,100 0,50"
          fill={PREVIEW_FILL}
          stroke={PREVIEW_BORDER}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      )}
      {shapeName === "cylinder" && (
        <>
          <path
            d="M 0,15 L 0,85 A 50,15 0 0,0 100,85 L 100,15 Z"
            fill={PREVIEW_FILL}
            stroke={PREVIEW_BORDER}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          <ellipse
            cx="50"
            cy="15"
            rx="50"
            ry="15"
            fill={PREVIEW_FILL}
            stroke={PREVIEW_BORDER}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}

function ShapeDragPreview() {
  const { shape, x, y } = useShapeDragPreview();

  // `createPortal` requires a real `document.body`. On the very first render
  // the hook runs server-side; gate the portal on a mounted flag to avoid
  // touching the DOM during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (shape === null) return null;

  // The preview is centered on the cursor (`useCanvasDrop` centers the
  // dropped node on the cursor too, so the visual position under the
  // cursor matches the eventual node center).
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{
        transform: `translate3d(${x - shape.width / 2}px, ${y - shape.height / 2}px, 0)`,
        opacity: 0.5,
      }}
    >
      <ShapeSilhouette shapeName={shape.name} width={shape.width} height={shape.height} />
    </div>,
    document.body,
  );
}

export { ShapeDragPreview };
