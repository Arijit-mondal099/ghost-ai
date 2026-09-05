"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useLiveblocksFlow } from "@liveblocks/react-flow";
import { ClientSideSuspense } from "@liveblocks/react/suspense";
import { LiveblocksProvider, RoomProvider } from "@liveblocks/react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { TrashIcon } from "lucide-react";

import { CanvasNode as CanvasNodeRenderer } from "@/components/editor/canvas/canvas-node";
import { CanvasEdge as CanvasEdgeRenderer } from "@/components/editor/canvas/canvas-edge";
import { ShapePanel } from "@/components/editor/canvas/shape-panel";
import { useCanvasDelete } from "@/hooks/use-canvas-delete";
import { useCanvasDrop } from "@/hooks/use-canvas-drop";
import { canvasEdge, canvasNode, type CanvasEdge, type CanvasNode } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Client wrapper for the per-project collaborative canvas.
//
// Sets up the Liveblocks provider stack (auth endpoint, room id, initial
// presence) and hands off to the inner <Canvas />, which mounts a
// <ReactFlowProvider> and the <CanvasSurface /> that uses the suspense
// build of useLiveblocksFlow and renders the React Flow surface. The
// suspense + error-boundary sandwich around <Canvas /> is required by the
// liveblocks/react-flow contract: the hook is the suspense form and any
// failure inside it must reach an ErrorBoundary ancestor.
//
// The canvas graph itself is owned by `useLiveblocksFlow`, which creates
// its own `flow` LiveObject on first render. The drop hook in
// `useCanvasDrop` writes new nodes into the same `flow` LiveObject via
// `useMutation`; the canvas surface then re-reads it on the next render.
//
// Spec: .claude/context/specs/11-base-canvas.md
// Spec: .claude/context/specs/12-shape-panel.md (drop handlers + shape panel)
// ---------------------------------------------------------------------------

type CanvasRoomProps = {
  roomId: string;
};

function CanvasErrorFallback({ error }: FallbackProps) {
  // Liveblocks connection errors surface here; logging once on mount is
  // enough — a render loop is impossible because this fallback is only
  // rendered when ErrorBoundary has caught a thrown error.
  console.error("Canvas connection error:", error);
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p className="text-sm text-copy-muted">Connection lost — refresh to retry</p>
    </div>
  );
}

const nodeTypes = { [canvasNode]: CanvasNodeRenderer } as const;
const edgeTypes = { [canvasEdge]: CanvasEdgeRenderer } as const;

// The drop hook calls `useReactFlow()` for screen-to-flow coordinate
// conversion, which requires a `<ReactFlowProvider>` ancestor. Splitting
// the inner component lets us call the hook *inside* the provider without
// affecting the outer `<Canvas />` lifecycle or the `useLiveblocksFlow`
// suspense boundary.
function CanvasSurface() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } = useLiveblocksFlow<
    CanvasNode,
    CanvasEdge
  >({ suspense: true });
  const drop = useCanvasDrop();
  const { selectedCount, deleteSelected, onSelectionChange } = useCanvasDelete({
    onDelete,
  });

  return (
    <div className="relative h-full w-full" onDragOver={drop.onDragOver} onDrop={drop.onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        onSelectionChange={onSelectionChange}
        deleteKeyCode={["Backspace", "Delete"]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{
          type: canvasEdge,
          markerEnd: { type: MarkerType.ArrowClosed, color: "var(--text-secondary)" },
        }}
        fitView
        className="h-full w-full"
        style={{ background: "var(--bg-base)" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--text-faint)" />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(17, 17, 17, 0.8)"
          style={{ background: "var(--bg-surface)" }}
          nodeColor={() => "var(--text-secondary)"}
        />
      </ReactFlow>
      {selectedCount > 0 && (
        <div className="absolute top-4 left-1/2 z-40 -translate-x-1/2">
          <button
            type="button"
            onClick={deleteSelected}
            title="Delete selected (Backspace)"
            aria-label={`Delete ${selectedCount} selected item${selectedCount === 1 ? "" : "s"}`}
            className="flex items-center gap-2 rounded-full border border-surface-border bg-elevated/95 px-3 py-1.5 text-xs text-copy-secondary shadow-lg backdrop-blur-md transition-colors hover:text-destructive"
          >
            <TrashIcon className="h-4 w-4" />
            <span>Delete ({selectedCount})</span>
          </button>
        </div>
      )}
      <ShapePanel />
    </div>
  );
}

function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasSurface />
    </ReactFlowProvider>
  );
}

function CanvasRoom({ roomId }: CanvasRoomProps) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider id={roomId} initialPresence={{ cursor: null, isThinking: false }}>
        <ErrorBoundary FallbackComponent={CanvasErrorFallback}>
          <ClientSideSuspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-sm text-copy-muted">Connecting…</span>
              </div>
            }
          >
            <Canvas />
          </ClientSideSuspense>
        </ErrorBoundary>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

export { CanvasRoom };
export type { CanvasRoomProps };
