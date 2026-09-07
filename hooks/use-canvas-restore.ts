"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useMutation } from "@liveblocks/react/suspense";
import { LiveObject, type LiveMap } from "@liveblocks/client";
import { useReactFlow } from "@xyflow/react";

import type { CanvasEdge, CanvasNode } from "@/types/canvas";

// ---------------------------------------------------------------------------
// One-shot canvas restore (spec 21).
//
// Mounted inside `CanvasSurface` alongside the autosave hook. After suspense
// resolves, if the Liveblocks room is empty it fetches the saved canvas JSON
// from `GET /api/projects/[projectId]/canvas` and bulk-inserts it into the
// `flow` LiveMaps (same atomic write path as the template-load hook). If the
// room already has nodes or edges the load is skipped entirely so active
// collaboration is never overwritten.
//
// `GET` returning 404 (`CANVAS_NOT_FOUND`) is the fresh-project case, not an
// error. On a successful restore the hook sets `restoreGuard` so the
// autosave hook skips the next change cycle instead of echoing the load back
// to Blob, and fits the viewport to the restored graph.
// ---------------------------------------------------------------------------

type LsonNodeRecord = Record<string, import("@liveblocks/client").Lson | undefined>;
type CanvasFlowLive = {
  nodes: LiveMap<string, LiveObject<LsonNodeRecord>>;
  edges: LiveMap<string, LiveObject<LsonNodeRecord>>;
};

type RestorePayload = { nodes: CanvasNode[]; edges: CanvasEdge[] };

type UseCanvasRestoreArgs = {
  projectId: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  restoreGuard: MutableRefObject<boolean>;
  /**
   * Shared with the sibling autosave hook (owned by `CanvasSurface`). Set to
   * true on EVERY exit path — content found, fresh project, skipped, failed,
   * or cancelled — so queued manual saves and empty-graph auto-saves blocked
   * on it always release.
   */
  restoreSettled: MutableRefObject<boolean>;
};

function isRestorePayload(value: unknown): value is RestorePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { nodes?: unknown; edges?: unknown };
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
}

function useCanvasRestore({
  projectId,
  nodes,
  edges,
  restoreGuard,
  restoreSettled,
}: UseCanvasRestoreArgs) {
  const ran = useRef(false);
  const reactFlow = useReactFlow();

  const replace = useMutation(({ storage }, payload: RestorePayload) => {
    // Same LSON-cast-at-the-boundary pattern as `useCanvasDrop` and
    // `useCanvasTemplateLoad`: the global `Liveblocks.Storage: {}` does not
    // model the canvas graph (owned by `useLiveblocksFlow`).
    const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
    const liveNodes = flow.get("nodes");
    const liveEdges = flow.get("edges");

    // Re-check inside the mutation: the pre-fetch emptiness check can go
    // stale if a collaborator writes between the fetch and this batch.
    // Never clear a room that gained content — report back so the caller
    // skips the guard and the fit.
    if (liveNodes.size > 0 || liveEdges.size > 0) return false;

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
    return true;
  }, []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Room already has content — never overwrite active collaboration.
    if (nodes.length > 0 || edges.length > 0) {
      restoreSettled.current = true;
      return;
    }

    let cancelled = false;
    void (async () => {
      // Settle helper: every exit below releases saves blocked on the flag.
      const settle = () => {
        restoreSettled.current = true;
      };
      let res: Response;
      try {
        res = await fetch(`/api/projects/${projectId}/canvas`, { cache: "no-store" });
      } catch {
        settle();
        return;
      }
      // Fresh project with nothing saved yet.
      if (res.status === 404) {
        settle();
        return;
      }
      if (!res.ok) {
        settle();
        return;
      }
      let saved: unknown;
      try {
        saved = await res.json();
      } catch {
        settle();
        return;
      }
      if (cancelled || !isRestorePayload(saved)) {
        settle();
        return;
      }
      if (saved.nodes.length === 0 && saved.edges.length === 0) {
        settle();
        return;
      }
      const restored = replace({ nodes: saved.nodes, edges: saved.edges });
      // The mutation re-checks emptiness atomically; only claim the restore
      // (guard + fit) when it actually wrote.
      if (cancelled || !restored) {
        settle();
        return;
      }
      restoreGuard.current = true;
      settle();
      window.requestAnimationFrame(() => {
        if (!cancelled) reactFlow.fitView({ duration: 200, padding: 0.1 });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, nodes.length, edges.length, replace, reactFlow, restoreGuard, restoreSettled]);
}

export { useCanvasRestore };
export type { UseCanvasRestoreArgs };
