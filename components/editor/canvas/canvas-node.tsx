"use client";

import { useEffect, useRef } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";

import { useCanvasLabelEdit } from "@/hooks/use-canvas-label-edit";
import { DEFAULT_NODE_SHAPE, NODE_COLORS, type CanvasNode, type NodeShape } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Custom renderer for the `canvasNode` type registered on the React Flow
// surface.
//
// The visual is a pure function of `data.shape` (+ `data.color` / `selected`):
// no local state, no effects, no remount keys. Moving a node only changes
// `position`, reconnecting an edge only changes edge `sourceHandle` /
// `targetHandle` — neither touches `data.shape` — so the rendered shape is
// stable across drags and reconnects by construction.
//
// Shape system (dimensions come from the drop payload in
// `lib/canvas/shape-definitions.ts` and are applied to the React Flow node
// `width` / `height` by `useCanvasDrop`; this renderer just fills its
// parent with `h-full w-full` so those dimensions are preserved verbatim):
// - `rectangle` — bordered box, `rounded-xl` (12px)
// - `circle`    — square payload (120x120) + 50% radius = true circle
// - `pill`      — wide payload (180x80) + full radius = capsule
// - `diamond` / `hexagon` / `cylinder` — inline SVG (per ui-context.md),
//   `viewBox 0 0 100 100` + `preserveAspectRatio="none"` so any payload
//   size stretches without distorting stroke (`non-scaling-stroke`).
//
// Each side carries a named Handle — `top` / `left` (target) and `right` /
// `bottom` (source) — so connection edges route to a stable side string
// instead of a position enum. Handles are small white dots (10px hit area)
// hidden until node hover/selected per ui-context.md — `group-hover` reveals
// them without losing connection ergonomics. Opacity lives in className (not
// inline style) so the hover reveal is not overridden. `isConnectable` is
// left at default so existing edges stay connectable.
//
// Resizing: `NodeResizer` (visible only when selected) emits `dimensions`
// changes through the already-wired `onNodesChange`, which
// `useLiveblocksFlow` syncs as `width`/`height` to room Storage — no extra
// wiring needed. Floors in `RESIZE_MIN` keep labels readable; `circle` keeps
// aspect ratio so it never becomes an ellipse.
//
// Label editing: see `useCanvasLabelEdit`. The `isEditing` branch swaps the
// static <span> for a <textarea> with `className="nodrag nopan"` so React
// Flow ignores text input gestures. `useEffect` + ref focuses the textarea
// and selects its current value on open so a single keystroke overwrites it.
// ---------------------------------------------------------------------------

const CSS_SHAPE_RADIUS: Record<string, string> = {
  rectangle: "12px",
  circle: "50%",
  pill: "9999px",
};

// Per-shape resize floors so labels stay readable. Circle keeps its aspect
// ratio so it stays a true circle at any size; every other shape resizes
// freely (SVG shapes stretch via `preserveAspectRatio="none"`).
const RESIZE_MIN: Record<
  NodeShape,
  { minWidth: number; minHeight: number; keepAspectRatio?: boolean }
> = {
  rectangle: { minWidth: 80, minHeight: 40 },
  circle: { minWidth: 60, minHeight: 60, keepAspectRatio: true },
  pill: { minWidth: 100, minHeight: 40 },
  diamond: { minWidth: 100, minHeight: 80 },
  cylinder: { minWidth: 80, minHeight: 70 },
  hexagon: { minWidth: 100, minHeight: 60 },
};

function CanvasNodeComponent({ id, data, selected }: NodeProps<CanvasNode>) {
  const colorPair = NODE_COLORS.find((c) => c.name === data.color) ?? NODE_COLORS[0];
  const shape: NodeShape = data.shape ?? DEFAULT_NODE_SHAPE;
  const borderColor = selected ? "var(--text-primary)" : "var(--border-default)";
  const glow = selected ? "0 0 0 2px var(--accent-primary-dim)" : undefined;
  const handleClass = selected
    ? "opacity-100 transition-opacity duration-150"
    : "opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:opacity-100";
  const resize = RESIZE_MIN[shape];

  const { isEditing, onStartEdit, onChange, onCommit, onCancel } = useCanvasLabelEdit({
    nodeId: id,
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [isEditing]);

  // CSS shapes: rectangle / circle / pill — a single bordered div whose
  // border-radius alone defines the silhouette.
  if (shape === "rectangle" || shape === "circle" || shape === "pill") {
    return (
      <div
        className="group relative flex h-full w-full items-center justify-center border text-xs"
        style={{
          background: colorPair.fill,
          color: colorPair.text,
          borderColor,
          borderRadius: CSS_SHAPE_RADIUS[shape],
          boxShadow: glow,
        }}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={resize.minWidth}
          minHeight={resize.minHeight}
          keepAspectRatio={resize.keepAspectRatio}
          lineStyle={resizerLineStyle}
          handleStyle={resizerHandleStyle}
        />
        <Handle
          id="top"
          type="target"
          position={Position.Top}
          style={handleStyle}
          className={handleClass}
        />
        <Handle
          id="left"
          type="target"
          position={Position.Left}
          style={handleStyle}
          className={handleClass}
        />
        {isEditing ? (
          <textarea
            ref={textareaRef}
            defaultValue={data.label}
            rows={1}
            placeholder="Label"
            onChange={(event) => onChange(event.target.value)}
            onBlur={onCommit}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
            // `nodrag` stops the node-drag gesture from stealing the mousedown;
            // `nopan` stops the canvas pan from the same. Both are the
            // @xyflow/react v12 defaults (see `noDragClassName` /
            // `noPanClassName` in the package's component props).
            className="nodrag nopan w-[80%] resize-none bg-transparent text-center text-xs outline-none placeholder:text-copy-muted"
          />
        ) : (
          <span
            className={data.label ? "select-none" : "select-none text-copy-muted"}
            onDoubleClick={onStartEdit}
          >
            {data.label || "Label"}
          </span>
        )}
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          style={handleStyle}
          className={handleClass}
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          style={handleStyle}
          className={handleClass}
        />
      </div>
    );
  }

  // SVG shapes: diamond / hexagon / cylinder — the outline is an SVG
  // polygon/path; the label is an absolutely-centered overlay so text never
  // distorts with `preserveAspectRatio="none"`.
  return (
    <div className="group relative h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={resize.minWidth}
        minHeight={resize.minHeight}
        keepAspectRatio={resize.keepAspectRatio}
        lineStyle={resizerLineStyle}
        handleStyle={resizerHandleStyle}
      />
      {shape === "diamond" && (
        <svg
          className="block h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon
            points="50,0 100,50 50,100 0,50"
            fill={colorPair.fill}
            stroke={borderColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            style={
              selected ? { filter: "drop-shadow(0 0 2px var(--accent-primary-dim))" } : undefined
            }
          />
        </svg>
      )}
      {shape === "hexagon" && (
        <svg
          className="block h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon
            points="25,0 75,0 100,50 75,100 25,100 0,50"
            fill={colorPair.fill}
            stroke={borderColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            style={
              selected ? { filter: "drop-shadow(0 0 2px var(--accent-primary-dim))" } : undefined
            }
          />
        </svg>
      )}
      {shape === "cylinder" && (
        <svg
          className="block h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M 0,15 L 0,85 A 50,15 0 0,0 100,85 L 100,15 Z"
            fill={colorPair.fill}
            stroke={borderColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            style={
              selected ? { filter: "drop-shadow(0 0 2px var(--accent-primary-dim))" } : undefined
            }
          />
          <ellipse
            cx="50"
            cy="15"
            rx="50"
            ry="15"
            fill={colorPair.fill}
            stroke={borderColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            defaultValue={data.label}
            rows={1}
            placeholder="Label"
            onChange={(event) => onChange(event.target.value)}
            onBlur={onCommit}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
            className="nodrag nopan w-[80%] max-w-[80%] resize-none bg-transparent text-center text-xs outline-none placeholder:text-copy-muted"
            style={{ color: colorPair.text }}
          />
        ) : (
          <span
            className={
              "max-w-[80%] text-center text-xs select-none " + (data.label ? "" : "text-copy-muted")
            }
            style={{ color: data.label ? colorPair.text : undefined }}
            onDoubleClick={onStartEdit}
          >
            {data.label || "Label"}
          </span>
        )}
      </div>
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        style={handleStyle}
        className={handleClass}
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        style={handleStyle}
        className={handleClass}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={handleStyle}
        className={handleClass}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        style={handleStyle}
        className={handleClass}
      />
    </div>
  );
}

const handleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  minWidth: 10,
  minHeight: 10,
  background: "#fff",
  border: "2px solid #111",
  borderRadius: "50%",
  zIndex: 20,
};

// Resize handles are small squares (vs. round connection handles) so the two
// affordances read differently. Lines use the primary text token to match the
// selected border.
const resizerLineStyle: React.CSSProperties = {
  stroke: "var(--text-primary)",
  strokeWidth: 1,
};

const resizerHandleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "#fff",
  border: "2px solid #111",
  borderRadius: 2,
};

export { CanvasNodeComponent as CanvasNode };
export type CanvasNodeProps = NodeProps<CanvasNode>;
