"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

import { useCanvasEdgeLabelEdit } from "@/hooks/use-canvas-edge-label-edit";
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
//
// Spec: .claude/context/specs/16-edge-behavior.md
// ---------------------------------------------------------------------------

function CanvasEdgeComponent({
  id,
  data,
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

  // Hook must run before any conditional returns (rules of hooks).
  const { isEditing, draft, onStartEdit, onChange, onCommit, onCancel } = useCanvasEdgeLabelEdit({
    edgeId: id,
  });

  const label = data?.label ?? "";

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
        {/* Saved labels stay visible as pill badges even when the edge is
            not selected (spec 16); the empty-label hint is selected-only. */}
        {label || selected ? (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: label && !selected ? "none" : "all",
            }}
            // `nodrag` stops the node-drag gesture from stealing the mousedown;
            // `nopan` stops the canvas pan from the same. Both are the
            // @xyflow/react v12 defaults (see `noDragClassName` /
            // `noPanClassName` in the package's component props).
            className="nodrag nopan"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {isEditing ? (
              <input
                autoFocus
                value={draft}
                size={Math.max(draft.length, 4) || 4}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onCommit}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") {
                    event.preventDefault();
                    if (event.key === "Escape") onCancel();
                    else onCommit();
                  }
                }}
                className="rounded-md border border-surface-border bg-base px-1.5 py-0.5 text-center text-xs text-copy-primary outline-none focus:border-accent-primary"
              />
            ) : label ? (
              selected ? (
                <button
                  type="button"
                  onDoubleClick={() => onStartEdit(label)}
                  className="rounded-md border border-surface-border bg-base px-1.5 py-0.5 text-xs text-copy-secondary"
                >
                  {label}
                </button>
              ) : (
                <span className="rounded-md border border-surface-border bg-base px-1.5 py-0.5 text-xs text-copy-secondary">
                  {label}
                </span>
              )
            ) : (
              <button
                type="button"
                onDoubleClick={() => onStartEdit(label)}
                className="rounded-md border border-dashed border-surface-border bg-base px-1.5 py-0.5 text-xs text-copy-muted"
              >
                Label
              </button>
            )}
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
}

export { CanvasEdgeComponent as CanvasEdge };
export type CanvasEdgeProps = EdgeProps<CanvasEdge>;
