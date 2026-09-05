"use client";

import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Fits the React Flow viewport to the freshly-imported template nodes.
//
// Why a separate mounted component: `useReactFlow()` must resolve inside
// `<ReactFlowProvider>`, which only lives around `CanvasSurface` inside
// `canvas-room.tsx`. The modal that triggers the import is rendered outside
// the canvas surface (siblings of the dialogs at the bottom of
// `editor-workspace-client.tsx`), so it cannot call the hook directly.
// Mounting this null-rendering component inside `CanvasSurface` keeps the
// imperative `fitView` reachable without restructuring the provider tree.
//
// Wiring: the workspace client owns a numeric `templateFitVersion` and
// passes it down. Each successful template import calls `onImported()`, the
// workspace bumps the version, and this effect fires `fitView` once. The
// effect uses `requestAnimationFrame` to defer one frame so React Flow has
// measured the freshly-inserted nodes before fitting.
//
// `ZOOM_DURATION_MS` / `padding` match `canvas-control-bar.tsx` so the fit
// animation reads as the same gesture as the user's manual fit-view button.
// ---------------------------------------------------------------------------

const ZOOM_DURATION_MS = 200;
const FIT_PADDING = 0.1;

function CanvasTemplateFitOnLoad({ version }: { version: number }) {
  const reactFlow = useReactFlow();
  const lastVersion = useRef(version);

  useEffect(() => {
    if (lastVersion.current === version) return;
    lastVersion.current = version;
    const id = window.requestAnimationFrame(() => {
      reactFlow.fitView({ duration: ZOOM_DURATION_MS, padding: FIT_PADDING });
    });
    return () => window.cancelAnimationFrame(id);
  }, [version, reactFlow]);

  return null;
}

export { CanvasTemplateFitOnLoad };
