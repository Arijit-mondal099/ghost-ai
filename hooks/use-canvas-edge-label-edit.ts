"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@liveblocks/react/suspense";
import { LiveMap, LiveObject } from "@liveblocks/client";

import type { CanvasEdgeData } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Inline label editor for a single canvas edge.
//
// Identical storage path to `useCanvasLabelEdit`, but writes to the edges
// LiveMap. Keeps label editing as a per-edge, per-keystroke CRDT write so
// every collaborator sees the same label without a custom sync config.
//
// Spec: .claude/context/specs/16-edge-behavior.md
// ---------------------------------------------------------------------------

type LsonEdgeRecord = Record<string, import("@liveblocks/client").Lson | undefined>;
type CanvasFlowLive = {
  nodes: LiveMap<string, LiveObject<LsonEdgeRecord>>;
  edges: LiveMap<string, LiveObject<LsonEdgeRecord>>;
};

type UseCanvasEdgeLabelEditArgs = { edgeId: string };

function useCanvasEdgeLabelEdit({ edgeId }: UseCanvasEdgeLabelEditArgs) {
  const [isEditing, setIsEditing] = useState(false);

  // The global `Liveblocks.Storage: {}` interface does not model the canvas
  // graph (the graph is owned by `@liveblocks/react-flow`'s generic hook),
  // so the same `as unknown as LiveObject<CanvasFlowLive>` cast at the
  // storage boundary that `useCanvasDrop` uses applies here.
  const setLabel = useMutation(
    ({ storage }, next: string) => {
      const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
      const edge = flow.get("edges").get(edgeId);
      if (!edge) return;
      const data = edge.get("data") as unknown as LiveObject<CanvasEdgeData> | undefined;
      if (!data) return;
      if (data.get("label") === next) return;
      data.set("label", next);
    },
    [edgeId],
  );

  const onStartEdit = useCallback(() => setIsEditing(true), []);
  const onChange = useCallback((next: string) => setLabel(next), [setLabel]);
  const onCommit = useCallback(() => setIsEditing(false), []);
  const onCancel = useCallback(() => setIsEditing(false), []);

  return { isEditing, onStartEdit, onChange, onCommit, onCancel };
}

export { useCanvasEdgeLabelEdit };
export type { UseCanvasEdgeLabelEditArgs };
