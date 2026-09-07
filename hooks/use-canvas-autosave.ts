"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

import type { CanvasEdge, CanvasNode } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Debounced canvas autosave (spec 21).
//
// Mounted inside `CanvasSurface` (the only place `nodes`/`edges` exist) and
// saves through `PUT /api/projects/[projectId]/canvas`, which persists the
// JSON to Vercel Blob and stores the blob URL on the Prisma project record.
//
// Coalescing strategy — a PUT fires only when ALL of these hold:
//   - the semantic snapshot changed (positions, data, structure — NOT
//     ephemeral flags like `selected`/`dragging`, so clicking around the
//     canvas never triggers a save),
//   - the snapshot stayed stable for AUTOSAVE_DEBOUNCE_MS (trailing debounce,
//     so a drag emitting dozens of position updates collapses to one save),
//   - the snapshot differs from the last successfully saved one (no
//     duplicate PUTs after a manual save or a restore echo).
// Manual saves (navbar button bumping `saveRequestVersion`) flush
// immediately, bypassing the debounce but still updating the saved snapshot.
// ---------------------------------------------------------------------------

export type CanvasSaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 2500;
// No autosave may fire until the local user has been quiet this long.
// Content changes reset the debounce timer, but a slow corner case remains:
// the timer can elapse while the user is mid-gesture (long drag, typing in a
// label input). The idle gate below re-arms the timer until the user stops
// interacting, so PUTs only fire when the workspace is actually at rest.
const USER_IDLE_MS = 3000;
// Poll interval while waiting for the sibling restore hook to settle.
const RESTORE_SETTLE_POLL_MS = 200;

type StrippedNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: unknown;
  width?: number | null;
  height?: number | null;
};

type StrippedEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  data: unknown;
};

function stripNode(node: CanvasNode): StrippedNode {
  return {
    id: node.id,
    type: node.type,
    position: { x: node.position.x, y: node.position.y },
    data: node.data,
    width: node.width ?? node.measured?.width,
    height: node.height ?? node.measured?.height,
  };
}

function stripEdge(edge: CanvasEdge): StrippedEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    data: edge.data,
  };
}

type UseCanvasAutosaveArgs = {
  projectId: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  saveRequestVersion: number;
  restoreGuard: MutableRefObject<boolean>;
  /**
   * Timestamp (ms) of the last local user interaction, owned by
   * `CanvasSurface` and bumped on pointer-down / active pointer-move /
   * key-down inside the canvas wrapper. Ref (not state) so signaling
   * activity never re-renders. Autosave fires only after USER_IDLE_MS of
   * quiet; remote collaborator changes still save once the local user is
   * idle.
   */
  lastActivityAt: MutableRefObject<number>;
  /**
   * False until the sibling restore hook settles (loaded, 404, skipped, or
   * failed — every exit path sets it). Owned by `CanvasSurface`, shared by
   * ref. While unset, manual saves queue instead of firing and empty-graph
   * auto-saves wait: firing either against a possibly-empty graph could PUT
   * emptiness over the saved canvas before the restore GET lands.
   */
  restoreSettled: MutableRefObject<boolean>;
  onStatusChange?: (status: CanvasSaveStatus) => void;
};

function useCanvasAutosave({
  projectId,
  nodes,
  edges,
  saveRequestVersion,
  restoreGuard,
  lastActivityAt,
  restoreSettled,
  onStatusChange,
}: UseCanvasAutosaveArgs): { status: CanvasSaveStatus; saveNow: () => void } {
  const [status, setStatus] = useState<CanvasSaveStatus>("idle");
  // Semantic snapshot: array identity from `useLiveblocksFlow` changes on
  // every storage sync (including ephemeral `selected`/`dragging` flags), so
  // the debounce watches this string instead — stable across re-renders and
  // selection-only changes.
  const snapshot = useMemo(
    () => JSON.stringify({ nodes: nodes.map(stripNode), edges: edges.map(stripEdge) }),
    [nodes, edges],
  );
  const latest = useRef({ nodes, edges, snapshot });
  // Sync post-commit, not during render: under concurrent rendering React
  // may discard a render, and a render-phase write would leave a discarded
  // graph in the ref for the debounce/manual-save callbacks to persist.
  useEffect(() => {
    latest.current = { nodes, edges, snapshot };
  }, [nodes, edges, snapshot]);
  const mounted = useRef(false);
  const lastManualVersion = useRef(saveRequestVersion);
  const lastSavedSnapshot = useRef<string | null>(null);
  const inFlight = useRef(false);
  const pendingAfterFlight = useRef(false);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const saveNow = useCallback(async () => {
    const { nodes: currentNodes, edges: currentEdges, snapshot: currentSnapshot } = latest.current;
    // Already persisting — re-run once the in-flight save lands instead of
    // stacking concurrent PUTs.
    if (inFlight.current) {
      pendingAfterFlight.current = true;
      return;
    }
    // Nothing new to persist (e.g. debounce fired after a manual save
    // already flushed the same content).
    if (lastSavedSnapshot.current === currentSnapshot) return;
    inFlight.current = true;
    setStatus("saving");
    try {
      const res = await fetch(`/api/projects/${projectId}/canvas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: currentNodes, edges: currentEdges }),
      });
      if (!res.ok) {
        let code = "UNKNOWN";
        try {
          const problem: unknown = await res.json();
          if (
            typeof problem === "object" &&
            problem !== null &&
            "error" in problem &&
            typeof (problem as { error: unknown }).error === "object" &&
            (problem as { error: { code?: unknown } }).error !== null &&
            typeof (problem as { error: { code?: unknown } }).error.code === "string"
          ) {
            code = (problem as { error: { code: string } }).error.code;
          }
        } catch {
          // Non-JSON error body — keep the UNKNOWN code.
        }
        throw new Error(`Canvas save failed (${res.status} ${code})`);
      }
      setStatus("saved");
      lastSavedSnapshot.current = currentSnapshot;
    } catch (error) {
      console.error("Canvas autosave failed:", error);
      setStatus("error");
    } finally {
      inFlight.current = false;
      // A change landed mid-save — persist it now that the wire is free.
      if (pendingAfterFlight.current) {
        pendingAfterFlight.current = false;
        void saveNow();
      }
    }
  }, [projectId]);

  // Debounced auto-save on semantic graph changes. Depends on the snapshot
  // string (not the array identities), so selection-only changes and
  // re-renders never schedule a save. The timer callback additionally waits
  // out local user activity: while the user is interacting (dragging, typing)
  // the timer re-arms itself until USER_IDLE_MS of quiet has passed.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (restoreGuard.current) {
      restoreGuard.current = false;
      lastSavedSnapshot.current = snapshot;
      return;
    }
    if (snapshot === lastSavedSnapshot.current) return;
    // No empty-graph skip: deleting the final node/edge must persist the
    // empty canvas, or a later empty-room restore would resurrect the deleted
    // graph from Blob. The mount guard (first run) and the restore guard
    // already prevent unwanted empty-state writes on load.
    let id = 0;
    const tick = () => {
      const quietFor = Date.now() - lastActivityAt.current;
      if (quietFor < USER_IDLE_MS) {
        id = window.setTimeout(tick, USER_IDLE_MS - quietFor);
        return;
      }
      // While the initial restore is still in flight, an empty graph may
      // just mean "not loaded yet" — wait for the settle flag rather than
      // persisting emptiness over the saved canvas. Non-empty content is
      // genuine user/collaborator work and saves normally.
      const { nodes: tickNodes, edges: tickEdges } = latest.current;
      if (!restoreSettled.current && tickNodes.length === 0 && tickEdges.length === 0) {
        id = window.setTimeout(tick, RESTORE_SETTLE_POLL_MS);
        return;
      }
      void saveNow();
    };
    id = window.setTimeout(tick, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [snapshot, nodes.length, edges.length, saveNow, restoreGuard, lastActivityAt, restoreSettled]);

  // Manual save requests from the navbar button. While the initial restore
  // is pending the request queues: firing immediately could PUT the
  // pre-restore (possibly empty) graph over the saved canvas.
  useEffect(() => {
    if (lastManualVersion.current === saveRequestVersion) return;
    lastManualVersion.current = saveRequestVersion;
    if (restoreSettled.current) {
      void saveNow();
      return;
    }
    const id = window.setInterval(() => {
      if (restoreSettled.current) {
        window.clearInterval(id);
        void saveNow();
      }
    }, RESTORE_SETTLE_POLL_MS);
    return () => window.clearInterval(id);
  }, [saveRequestVersion, saveNow, restoreSettled]);

  const saveNowManual = useCallback(() => {
    void saveNow();
  }, [saveNow]);

  return { status, saveNow: saveNowManual };
}

export { useCanvasAutosave };
export type { UseCanvasAutosaveArgs };
