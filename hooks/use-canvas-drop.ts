"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useMutation } from "@liveblocks/react/suspense";
import { LiveObject, type LiveMap } from "@liveblocks/client";

import {
  generateShapeNodeId,
  SHAPE_DRAG_MIME,
  type ShapeDefinition,
} from "@/lib/canvas/shape-definitions";
import {
  canvasNode,
  DEFAULT_NODE_COLOR,
  type CanvasNode,
  type CanvasNodeData,
} from "@/types/canvas";

// ---------------------------------------------------------------------------
// Drag-and-drop bridge between the bottom shape panel and the React Flow
// surface. Returns the two DOM event handlers that the canvas wrapper
// spreads on its outer <div>.
//
// The drop handler is the only place that knows about the `flow` LiveObject
// on the room's Storage. `useMutation` from `@liveblocks/react/suspense` runs
// the insert inside a Liveblocks-batched transaction, so the new node
// propagates to every connected client in the same single batch that the
// `useLiveblocksFlow` hook reads from on the next render.
//
// The global `Liveblocks.Storage` interface is intentionally kept as `{}` —
// the canvas graph is owned by `@liveblocks/react-flow`'s `useLiveblocksFlow`
// hook, which creates the `flow` LiveObject on first render and is generic
// over the node/edge shape. We cast through the package's LSON-compatible
// `Record<string, Lson>` boundary so the storage get/set calls match what
// the package itself does (see `node_modules/@liveblocks/react-flow/dist/
// lib/shared.js`, where `toLiveblocksInternalNode` calls
// `LiveObject.from(node, config)` with the same node shape).
//
// The new node is wrapped via `LiveObject.from(node)` — the same helper
// `@liveblocks/react-flow` uses internally when handling React Flow's `add`
// change event. The package's per-key sync config is applied at that
// boundary, matching how every other write into the canvas storage happens.
// ---------------------------------------------------------------------------

type LsonNodeRecord = Record<string, import("@liveblocks/client").Lson | undefined>;
type CanvasFlowLive = {
  nodes: LiveMap<string, LiveObject<LsonNodeRecord>>;
  edges: LiveMap<string, LiveObject<LsonNodeRecord>>;
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

function useCanvasDrop() {
  const { screenToFlowPosition } = useReactFlow();

  const insertNode = useMutation(({ storage }, node: CanvasNode) => {
    // The canvas graph lives under the `flow` key written by
    // `useLiveblocksFlow`. Cast through the LSON-compatible type at the
    // storage boundary — the global `Liveblocks.Storage: {}` interface
    // does not model the canvas graph (the graph is owned by
    // `@liveblocks/react-flow`'s generic hook).
    const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
    const nodes = flow.get("nodes");
    const liveNode = LiveObject.from(node as unknown as Parameters<typeof LiveObject.from>[0]);
    nodes.set(node.id, liveNode as unknown as LiveObject<LsonNodeRecord>);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const raw = event.dataTransfer.getData(SHAPE_DRAG_MIME);
      if (!raw) return;

      let payload: ShapeDefinition;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isShapeDefinition(parsed)) return;
        payload = parsed;
      } catch {
        return;
      }

      const { x: screenX, y: screenY } = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Center the node on the cursor (matches the Figma / Sketch feel).
      const x = screenX - payload.width / 2;
      const y = screenY - payload.height / 2;

      const data: CanvasNodeData = {
        label: "",
        color: DEFAULT_NODE_COLOR,
        shape: payload.name,
      };

      const node: CanvasNode = {
        id: generateShapeNodeId(payload.name),
        type: canvasNode,
        position: { x, y },
        data,
        width: payload.width,
        height: payload.height,
        measured: { width: payload.width, height: payload.height },
        origin: [0.5, 0.5],
      };

      insertNode(node);
    },
    [insertNode, screenToFlowPosition],
  );

  return { onDragOver, onDrop };
}

export { useCanvasDrop };
