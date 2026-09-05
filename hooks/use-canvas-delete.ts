"use client";

import { useCallback, useEffect, useState } from "react";
import { useReactFlow, type OnDelete } from "@xyflow/react";

import type { CanvasEdge, CanvasNode } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Selection deletion for the collaborative canvas.
//
// Deletion MUST go through `useLiveblocksFlow`'s `onDelete` mutation — its
// `onNodesChange` / `onEdgesChange` handlers intentionally ignore `remove`
// changes (`case "remove": break` in `@liveblocks/react-flow/dist/lib/flow.js`).
// `onDelete` deletes node/edge ids from the room Storage LiveMaps, so every
// delete propagates to all connected clients. Deleting nodes also removes
// their connected edges, so selected + connected edges are deleted together.
//
// Keyboard: Backspace/Delete (skipped inside inputs / contentEditable).
// Button: `selectedCount` / `deleteSelected` drive a floating delete UI.
// ---------------------------------------------------------------------------

type UseCanvasDeleteArgs = {
  onDelete: OnDelete<CanvasNode, CanvasEdge>;
};

function useCanvasDelete({ onDelete }: UseCanvasDeleteArgs) {
  const { getNodes, getEdges } = useReactFlow<CanvasNode, CanvasEdge>();
  const [selectedCount, setSelectedCount] = useState(0);

  const onSelectionChange = useCallback(
    ({ nodes, edges }: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
      setSelectedCount(nodes.length + edges.length);
    },
    [],
  );

  const deleteSelected = useCallback(() => {
    const selectedNodes = getNodes().filter((node) => node.selected);
    const selectedEdges = getEdges().filter((edge) => edge.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return false;

    const nodeIds = new Set(selectedNodes.map((node) => node.id));
    const connectedEdges = getEdges().filter(
      (edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target),
    );
    const edgeMap = new Map(connectedEdges.map((edge) => [edge.id, edge]));
    for (const edge of selectedEdges) edgeMap.set(edge.id, edge);

    onDelete({ nodes: selectedNodes, edges: [...edgeMap.values()] });
    return true;
  }, [getNodes, getEdges, onDelete]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (deleteSelected()) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected]);

  return { selectedCount, deleteSelected, onSelectionChange };
}

export { useCanvasDelete };
