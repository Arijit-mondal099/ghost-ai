"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

import { type CanvasEdge } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Custom renderer for the `canvasEdge` type registered on the React Flow
// surface.
//
// React Flow's default smoothstep edge paints in a near-black stroke with
// a black arrow marker, which is invisible on the dark canvas surface
// (`--bg-base` is `#111111`). This custom edge uses the project's
// `--text-secondary` token for both the stroke and the arrow marker so
// connections read clearly on the dark surface and pick up theme updates
// automatically.
//
// `getSmoothStepPath` is the same helper the default smoothstep edge
// uses — the `borderRadius` option rounds the corners so the line doesn't
// cut tight 90° angles through node bodies, and the liveblocks-react-flow
// re-renders on every drag frame so the line tracks node motion smoothly
// without any extra wiring.
// ---------------------------------------------------------------------------

function CanvasEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
}: EdgeProps<CanvasEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={20}
        style={{
          stroke: selected ? "var(--text-primary)" : "var(--text-secondary)",
          strokeWidth: selected ? 1.75 : 1.25,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "none",
          }}
        />
      </EdgeLabelRenderer>
    </>
  );
}

export { CanvasEdgeComponent as CanvasEdge };
export type CanvasEdgeProps = EdgeProps<CanvasEdge>;
