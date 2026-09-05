"use client";

import { useCallback } from "react";
import { useMutation } from "@liveblocks/react/suspense";
import { LiveMap, LiveObject } from "@liveblocks/client";

import { type CanvasNodeData, type NodeColor } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Color-picker mutation for a single canvas node.
//
// The `data.color` field already exists on `CanvasNodeData`
// (see `types/canvas.ts`) and the node renderer already reads the matching
// `NODE_COLORS` pair to apply both the background fill and the text color in
// a single lookup. This hook only writes that one field — the visual update
// is automatic on the next render of `canvas-node.tsx`, and the change
// propagates to every connected client through the same `flow` LiveObject
// that `useLiveblocksFlow`, `useCanvasDrop`, and `useCanvasLabelEdit` already
// operate on. No server calls, no new schema, no new field.
//
// The mutation short-circuits when the requested color already matches the
// stored one — same guard `useCanvasLabelEdit` uses — so spurious writes
// (e.g. clicking the already-active swatch) don't generate a storage event
// and re-broadcast to every peer.
//
// Spec: .claude/context/specs/15-nodes-color-toolbar.md
// ---------------------------------------------------------------------------

type LsonNodeRecord = Record<string, import("@liveblocks/client").Lson | undefined>;
type CanvasFlowLive = {
  nodes: LiveMap<string, LiveObject<LsonNodeRecord>>;
  edges: LiveMap<string, LiveObject<LsonNodeRecord>>;
};

type UseCanvasColorEditArgs = { nodeId: string };

function useCanvasColorEdit({ nodeId }: UseCanvasColorEditArgs) {
  // The global `Liveblocks.Storage: {}` interface does not model the canvas
  // graph (the graph is owned by `@liveblocks/react-flow`'s generic hook),
  // so the same `as unknown as LiveObject<CanvasFlowLive>` cast at the
  // storage boundary that `useCanvasDrop` and `useCanvasLabelEdit` use
  // applies here.
  const setColor = useMutation(
    ({ storage }, next: NodeColor) => {
      const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
      const node = flow.get("nodes").get(nodeId);
      if (!node) return;
      const data = node.get("data") as unknown as LiveObject<CanvasNodeData> | undefined;
      if (!data) return;
      if (data.get("color") === next) return;
      data.set("color", next);
    },
    [nodeId],
  );

  const onSetColor = useCallback((next: NodeColor) => setColor(next), [setColor]);

  return { onSetColor };
}

export { useCanvasColorEdit };
export type { UseCanvasColorEditArgs };
