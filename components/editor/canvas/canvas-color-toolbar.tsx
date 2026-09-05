"use client";

import { useEffect, useState } from "react";
import { useStore, useViewport } from "@xyflow/react";
import { useLiveblocksFlow } from "@liveblocks/react-flow";

import { useCanvasColorEdit } from "@/hooks/use-canvas-color-edit";
import { NODE_COLORS, type CanvasEdge, type CanvasNode } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Floating color toolbar for the single selected canvas node.
//
// Renders a row of swatches (one per `NODE_COLORS` pair) immediately above
// the selected node. The toolbar is a sibling of `<ReactFlow>` inside the
// canvas surface's `relative` wrapper, so the `absolute` + `transform`
// positioning math below places it in the same coordinate system as the
// delete pill at `canvas-room.tsx:115-128`.
//
// Screen position math: flow-space `position` is anchored at `origin`
// (dropped / template nodes use `origin: [0.5, 0.5]`, so `position` is the
// node center). Subtract `origin * dimensions` to recover the top-left,
// then convert to screen space with the viewport `x/y` + `zoom`.
// Adding `width * zoom / 2` puts the anchor on the node's horizontal
// center; `translate(-50%, -100%)` on the toolbar root lifts it entirely
// above that anchor, so only an 8px gap is subtracted to leave space
// between the toolbar's bottom edge and the node's top edge.
// Using the live viewport + the live `nodes` array from `useLiveblocksFlow`
// means a single re-render per frame when panning/zooming/dragging — no
// `requestAnimationFrame` queueing needed.
//
// `nodrag` and `nopan` on the toolbar root opt the swatch buttons out of
// React Flow's drag/pan gestures (the v12 default `noDragClassName` /
// `noPanClassName`). The same class pair protects the inline label textarea
// at `canvas-node.tsx:148, 274` — established pattern, no per-event
// `stopPropagation` needed.
//
// Spec: .claude/context/specs/15-nodes-color-toolbar.md
// ---------------------------------------------------------------------------

// `TOOLBAR_GAP` leaves space between the toolbar's bottom edge and the
// node's top edge. No height constant is needed — the root's
// `translate(-50%, -100%)` already lifts the toolbar by its own height.
const TOOLBAR_GAP = 8;

const swatchClassName =
  "nodrag nopan h-[18px] w-[18px] cursor-pointer rounded-full border-[1.5px] border-surface-border transition-[box-shadow,border-color] duration-150";

function CanvasColorToolbar() {
  // `useLiveblocksFlow` is the same hook `CanvasSurface` uses; the toolbar
  // subscribes to it directly so the selected-node read stays in sync with
  // every other client (no prop-drilling through `CanvasSurface`).
  const { nodes } = useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true });

  // The viewport (`{x, y, zoom}`) drives the screen-space math below.
  // Re-renders on every pan/zoom tick — exactly what we want.
  const { x: vx, y: vy, zoom } = useViewport();

  // `useStore` here is React Flow's zustand-backed store, not a Liveblocks
  // selector. We pick `paneDragging` to keep the toolbar's pointer-events
  // inert while the user pans the canvas (otherwise a stray click on a
  // swatch during a pan would set a new color).
  const paneDragging = useStore((s) => s.paneDragging);

  const [hovered, setHovered] = useState<string | null>(null);

  // SSR gate — the toolbar reads `useStore` / `useViewport`, both of which
  // need a real DOM. The first render returns null; `useEffect` flips the
  // flag on the next tick (after hydration). Same pattern as
  // `ShapeDragPreview` (`shape-drag-preview.tsx:120-125`).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Visibility: exactly one selected node. Multi-select is a no-op here
  // (color is per-node, and the delete pill at the top of the canvas
  // already covers multi-select affordances).
  const selected = nodes.filter((node) => node.selected);
  const node = selected.length === 1 ? selected[0] : null;

  // The color-mutation hook must run on EVERY render — putting it after
  // the early returns would violate the rules of hooks (React would see
  // the hook appear when a node becomes selected and disappear when the
  // user deselects, even though `node` is just a derived value). The
  // mutation body itself no-ops on an unknown id (`if (!node) return;`),
  // so passing a stale id while nothing is selected is harmless.
  const { onSetColor } = useCanvasColorEdit({ nodeId: node?.id ?? "" });

  if (!mounted) return null;
  if (node === null) return null;

  // Screen-space top-center anchor: `position` is origin-anchored
  // (`origin: [0.5, 0.5]` on canvas nodes means the center), so recover
  // the top-left first; the viewport `x`/`y` is the canvas translation
  // and `zoom` scales everything.
  const nodeWidth = node.measured?.width ?? node.width ?? 0;
  const nodeHeight = node.measured?.height ?? node.height ?? 0;
  const [originX, originY] = node.origin ?? [0, 0];
  const left = (node.position.x - originX * nodeWidth) * zoom + vx + (nodeWidth * zoom) / 2;
  const top = (node.position.y - originY * nodeHeight) * zoom + vy;

  return (
    <div
      role="toolbar"
      aria-label="Node color"
      // `nodrag` / `nopan` are the @xyflow/react v12 default
      // `noDragClassName` / `noPanClassName` — opt the toolbar out of the
      // canvas drag/pan gestures. `pointer-events-none` while the user is
      // panning so a stray swatch click during a drag doesn't change the
      // color. The toolbar still renders (so the position tracks the
      // viewport), but the swatches don't intercept the cursor.
      className="nodrag nopan absolute z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-surface-border bg-elevated/95 px-2 py-1.5 shadow-lg backdrop-blur-md"
      style={{
        left,
        // `-100%` in the root `transform` lifts the toolbar entirely above
        // the `top` anchor (the node's top edge); subtract only the gap.
        top: top - TOOLBAR_GAP,
        transform: "translate(-50%, -100%)",
        pointerEvents: paneDragging ? "none" : "auto",
      }}
    >
      {NODE_COLORS.map((colorPair) => {
        const isActive = colorPair.name === node.data.color;
        const isHovered = hovered === colorPair.name;
        return (
          <button
            key={colorPair.name}
            type="button"
            aria-label={colorPair.name}
            aria-pressed={isActive}
            disabled={paneDragging}
            onClick={() => onSetColor(colorPair.name)}
            onMouseEnter={() => setHovered(colorPair.name)}
            onMouseLeave={() => setHovered(null)}
            className={
              swatchClassName +
              // The active swatch gets a brighter border to read as
              // "currently selected" against the muted default border.
              (isActive ? " border-copy-primary" : "")
            }
            style={{
              background: colorPair.fill,
              // Active ring mirrors `canvas-node.tsx:75` — a 2px ring in
              // the brand-dim token, tight and centered.
              // Hover glow uses the swatch's text color per spec 15 line
              // 17 ("subtle glow based on its text color"). 6px blur + 1px
              // spread is "tight" rather than the typical 8–12px halo.
              // The active ring wins on the active swatch so its identity
              // is unambiguous when hovered.
              boxShadow: isActive
                ? "0 0 0 2px var(--accent-primary-dim)"
                : isHovered
                  ? `0 0 6px 1px ${colorPair.text}`
                  : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export { CanvasColorToolbar };
