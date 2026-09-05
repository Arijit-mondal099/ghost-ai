"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation } from "@liveblocks/react/suspense";
import { LiveMap, LiveObject } from "@liveblocks/client";

import type { CanvasNodeData } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Inline label editor for a single canvas node.
//
// Owns the local `isEditing` flag and the Liveblocks mutation that persists
// `data.label` back into the room's collaborative storage. The component
// using this hook stays a pure function of `data.label` + `isEditing` — it
// never reads/writes Liveblocks directly. All canvas graph writes go through
// `useMutation` and the same `flow` LiveObject that `useLiveblocksFlow` and
// `useCanvasDrop` already operate on, so every label edit propagates to
// other connected clients through the existing sync path.
//
// The textarea is uncontrolled: it seeds its `defaultValue` from `data.label`
// on every edit open. We never mirror `data.label` to a local React state
// because doing so would lose cross-client edits mid-typing — each keystroke
// is a CRDT write, and the next open re-reads from storage. Because drafts
// persist per keystroke, cancel (Escape) restores the label captured at
// edit open so the abandoned draft does not linger in shared storage.
//
// Spec: .claude/context/specs/14-node-editing.md
// ---------------------------------------------------------------------------

type LsonNodeRecord = Record<string, import("@liveblocks/client").Lson | undefined>;
type CanvasFlowLive = {
  nodes: LiveMap<string, LiveObject<LsonNodeRecord>>;
  edges: LiveMap<string, LiveObject<LsonNodeRecord>>;
};

type UseCanvasLabelEditArgs = { nodeId: string };

function useCanvasLabelEdit({ nodeId }: UseCanvasLabelEditArgs) {
  const [isEditing, setIsEditing] = useState(false);
  const initialRef = useRef("");

  // The global `Liveblocks.Storage: {}` interface does not model the canvas
  // graph (the graph is owned by `@liveblocks/react-flow`'s generic hook),
  // so the same `as unknown as LiveObject<CanvasFlowLive>` cast at the
  // storage boundary that `useCanvasDrop` uses applies here.
  const setLabel = useMutation(
    ({ storage }, next: string) => {
      const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
      const node = flow.get("nodes").get(nodeId);
      if (!node) return;
      const data = node.get("data") as unknown as LiveObject<CanvasNodeData> | undefined;
      if (!data) return;
      if (data.get("label") === next) return;
      data.set("label", next);
    },
    [nodeId],
  );

  const onStartEdit = useCallback((initial = "") => {
    initialRef.current = initial;
    setIsEditing(true);
  }, []);
  const onChange = useCallback((next: string) => setLabel(next), [setLabel]);
  const onCommit = useCallback(() => setIsEditing(false), []);
  const onCancel = useCallback(() => {
    setLabel(initialRef.current);
    setIsEditing(false);
  }, [setLabel]);

  return { isEditing, onStartEdit, onChange, onCommit, onCancel };
}

export { useCanvasLabelEdit };
export type { UseCanvasLabelEditArgs };
