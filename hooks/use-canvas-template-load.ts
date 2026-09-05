"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@liveblocks/react/suspense";
import { LiveObject, type LiveMap } from "@liveblocks/client";
import { MarkerType } from "@xyflow/react";

import { SHAPES } from "@/lib/canvas/shape-definitions";
import {
  canvasEdge,
  canvasNode,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeData,
  type CanvasEdgeData,
} from "@/types/canvas";
import {
  type CanvasTemplate,
  type TemplateNode,
  type TemplateEdge,
} from "@/components/editor/starter-templates";

// ---------------------------------------------------------------------------
// Starter-template load hook (spec 18).
//
// Replaces the entire current canvas with a chosen template: clear both
// `flow.nodes` and `flow.edges` `LiveMap`s, then bulk-insert each template
// node and edge wrapped via `LiveObject.from(...)` — the same write path
// `@liveblocks/react-flow` uses internally and the same path every other
// canvas-write hook (drop, label, color, edge label) uses. The mutation is
// atomic, so other connected clients see either the pre-state or the
// post-state, never a half-cleared canvas.
//
// The hook must be rendered inside a `<RoomProvider>` (it does) so that
// `useMutation` resolves `storage` from the room context — same contract as
// `useCanvasDrop`, `useCanvasColorEdit`, `useCanvasLabelEdit`, and
// `useCanvasEdgeLabelEdit`.
//
// ID strategy: each import gets a fresh `nonce` (a randomUUID fallback to
// `${Date.now()}-${Math.random()}`). IDs are `${templateId}--${key}--${nonce}`
// for nodes and `${templateId}--${src}-${tgt}--${nonce}` for edges, so:
//   - re-importing the same template never collides with the previous
//     import's IDs (React Flow never sees duplicate keys),
//   - within one import, edges reference the freshly-created node IDs
//     deterministically.
// ---------------------------------------------------------------------------

type LsonNodeRecord = Record<string, import("@liveblocks/client").Lson | undefined>;
type CanvasFlowLive = {
  nodes: LiveMap<string, LiveObject<LsonNodeRecord>>;
  edges: LiveMap<string, LiveObject<LsonNodeRecord>>;
};

function generateNonce(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function shapeDimensions(shape: TemplateNode["shape"]): { width: number; height: number } {
  const def = SHAPES.find((s) => s.name === shape);
  // The shape vocabulary is shared between data and renderer; if a template
  // ever references a shape outside `SHAPES` the dev-only assertion in
  // `starter-templates.ts` won't catch it but the load would. Keep this
  // fallback so the page doesn't crash on a malformed entry — fall back to
  // the rectangle dimensions.
  if (!def) return { width: 160, height: 80 };
  return { width: def.width, height: def.height };
}

function expandNode(templateId: string, nonce: string, n: TemplateNode): CanvasNode {
  const { width, height } = shapeDimensions(n.shape);
  const data: CanvasNodeData = { label: n.label, color: n.color, shape: n.shape };
  return {
    id: `${templateId}--${n.key}--${nonce}`,
    type: canvasNode,
    position: { x: n.x, y: n.y },
    data,
    width,
    height,
    measured: { width, height },
    origin: [0.5, 0.5],
  };
}

function expandEdge(templateId: string, nonce: string, e: TemplateEdge): CanvasEdge {
  const data: CanvasEdgeData = { label: e.label ?? "" };
  return {
    id: `${templateId}--${e.source}-${e.target}--${nonce}`,
    source: `${templateId}--${e.source}--${nonce}`,
    target: `${templateId}--${e.target}--${nonce}`,
    type: canvasEdge,
    data,
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--text-secondary)" },
  };
}

type ReplacePayload = { nodes: CanvasNode[]; edges: CanvasEdge[] };

function useCanvasTemplateLoad(): {
  loadTemplate: (template: CanvasTemplate) => Promise<void>;
  isLoading: boolean;
} {
  const [isLoading, setIsLoading] = useState(false);

  const replace = useMutation(({ storage }, payload: ReplacePayload) => {
    // Same LSON-cast-at-the-boundary pattern as `useCanvasDrop` and the
    // other edit hooks. The global `Liveblocks.Storage: {}` interface does
    // not model the canvas graph (the graph is owned by
    // `@liveblocks/react-flow`'s `useLiveblocksFlow`).
    const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
    const liveNodes = flow.get("nodes");
    const liveEdges = flow.get("edges");

    // `LiveMap` has no `clear()` — delete in a loop. The mutation is
    // atomic, so peers see either the pre-state or the post-state.
    for (const key of Array.from(liveNodes.keys())) liveNodes.delete(key);
    for (const key of Array.from(liveEdges.keys())) liveEdges.delete(key);

    for (const node of payload.nodes) {
      const live = LiveObject.from(node as unknown as Parameters<typeof LiveObject.from>[0]);
      liveNodes.set(node.id, live as unknown as LiveObject<LsonNodeRecord>);
    }
    for (const edge of payload.edges) {
      const live = LiveObject.from(edge as unknown as Parameters<typeof LiveObject.from>[0]);
      liveEdges.set(edge.id, live as unknown as LiveObject<LsonNodeRecord>);
    }
  }, []);

  const loadTemplate = useCallback(
    async (template: CanvasTemplate): Promise<void> => {
      setIsLoading(true);
      try {
        const nonce = generateNonce();
        const nodes = template.nodes.map((n) => expandNode(template.id, nonce, n));
        const edges = template.edges.map((e) => expandEdge(template.id, nonce, e));
        replace({ nodes, edges });
        // Give React Flow a microtask to reconcile the storage changes
        // before the modal closes and the workspace triggers a fit.
        await Promise.resolve();
      } finally {
        setIsLoading(false);
      }
    },
    [replace],
  );

  return { loadTemplate, isLoading };
}

export { useCanvasTemplateLoad };
