# Implementation Plan: Bottom Shape Panel (Spec 12)

## Context

The canvas (`components/editor/canvas/canvas-room.tsx`) is now an empty React Flow surface backed by Liveblocks multiplayer storage. The base canvas unit (spec 11) shipped the provider stack, the room wiring, and the background/minimap chrome — but there's no way to add nodes today. Spec 12 introduces the first node-creation path: a drag-source toolbar at the bottom-center of the canvas. The user picks a shape, drags it onto the canvas, and a new node appears at the drop point, synced to all room members in real time. The unit also registers the project's custom `canvasNode` type so dropped nodes render through project code instead of React Flow's built-in default node.

## New Files

### `lib/canvas/shape-definitions.ts`

Single source of truth for the 6 shapes, their default sizes, the drag MIME type, and the ID generator. Lives in `lib/` (infrastructure) because it's consumed by both the shape panel component and the drop hook.

```ts
export const SHAPE_DRAG_MIME = "application/x-ghost-shape";

export const SHAPES = [
  { name: "rectangle", width: 160, height: 80 }, // wider than tall (2:1)
  { name: "diamond", width: 160, height: 120 }, // larger for diagonal label
  { name: "circle", width: 120, height: 120 }, // square
  { name: "pill", width: 180, height: 80 }, // wider (2.25:1)
  { name: "cylinder", width: 140, height: 110 }, // slightly taller
  { name: "hexagon", width: 180, height: 110 }, // wider for diagonal text
] as const;

export type ShapeName = (typeof SHAPES)[number]["name"];
export type ShapeDefinition = (typeof SHAPES)[number];

// Per-spec ID format: shape name + timestamp + counter.
const counters: Partial<Record<ShapeName, number>> = {};
export function generateShapeNodeId(shape: ShapeName): string {
  counters[shape] = (counters[shape] ?? 0) + 1;
  return `${shape}-${Date.now()}-${counters[shape]}`;
}
```

No `"use client"` — pure data + pure function.

### `components/editor/canvas/canvas-node.tsx`

The custom `canvasNode` renderer. Per spec: every shape renders as a simple bordered rectangle with the label centered (shape-specific visuals come in a later spec).

```tsx
"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_COLORS, type CanvasNode } from "@/types/canvas";

function CanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const colorPair = NODE_COLORS.find((c) => c.name === data.color) ?? NODE_COLORS[0];
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-xl border text-xs"
      style={{
        background: colorPair.fill,
        color: colorPair.text,
        borderColor: "var(--border-default)",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export { CanvasNode };
export type { NodeProps };
```

Handles (4 total: target top+left, source right+bottom) make new nodes connectable without a separate spec for the visual connectors. The current canvas uses `connectionMode={ConnectionMode.Loose}`, so any source handle to any target handle will connect.

### `components/editor/canvas/shape-panel.tsx`

The floating pill toolbar. Client component — drag events are browser-only.

```tsx
"use client";
import {
  RectangleHorizontalIcon,
  DiamondIcon,
  CircleIcon,
  PillIcon,
  CylinderIcon,
  HexagonIcon,
} from "lucide-react";
import { SHAPES, SHAPE_DRAG_MIME, type ShapeDefinition } from "@/lib/canvas/shape-definitions";

const ICONS: Record<ShapeDefinition["name"], React.ComponentType> = {
  rectangle: RectangleHorizontalIcon,
  diamond: DiamondIcon,
  circle: CircleIcon,
  pill: PillIcon,
  cylinder: CylinderIcon,
  hexagon: HexagonIcon,
};

function ShapePanel() {
  return (
    <div className="pointer-events-auto fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-3xl border border-surface-border bg-elevated/95 px-2 py-2 shadow-lg backdrop-blur-md">
        {SHAPES.map((shape) => {
          const Icon = ICONS[shape.name];
          return (
            <button
              key={shape.name}
              type="button"
              draggable
              aria-label={`Add ${shape.name}`}
              title={shape.name}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(SHAPE_DRAG_MIME, JSON.stringify(shape));
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary"
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { ShapePanel };
```

Tokens: `bg-elevated/95`, `border-surface-border`, `text-copy-secondary`, `text-copy-primary`, `bg-subtle` (all already defined in `app/globals.css`). `rounded-3xl` matches the project's "modals" radius scale and is the right size for a floating panel above the canvas. Position: `fixed bottom-6 left-1/2 -translate-x-1/2 z-40` (same z-layer as the sidebars).

### `hooks/use-canvas-drop.ts`

The drop handler. Returns `{ onDragOver, onDrop }` to spread on the canvas wrapper. The hook is the only place that knows about the `flow` LiveObject on Liveblocks Storage — keeps that detail out of the component file.

```ts
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

function isShapeDefinition(value: unknown): value is ShapeDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { width?: unknown }).width === "number" &&
    typeof (value as { height?: unknown }).height === "number"
  );
}

function useCanvasDrop() {
  const { screenToFlowPosition } = useReactFlow();
  const insertNode = useMutation(
    ({ storage }, liveNode: LiveObject<{ id: string } & Record<string, unknown>>) => {
      const flow = storage.get("flow");
      const nodes = flow.get("nodes") as LiveMap<string, typeof liveNode>;
      nodes.set(liveNode.get("id") as string, liveNode);
    },
    [],
  );

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
      // Center the node on the cursor.
      const x = screenX - payload.width / 2;
      const y = screenY - payload.height / 2;

      const data: CanvasNodeData = {
        label: "",
        color: DEFAULT_NODE_COLOR,
        shape: payload.name,
      };

      const liveNode = new LiveObject({
        id: generateShapeNodeId(payload.name),
        type: canvasNode,
        position: { x, y },
        data,
        width: payload.width,
        height: payload.height,
        style: { width: payload.width, height: payload.height },
        measured: { width: payload.width, height: payload.height },
        origin: [0.5, 0.5] as [number, number],
      });

      insertNode(liveNode);
    },
    [insertNode, screenToFlowPosition],
  );

  return { onDragOver, onDrop };
}

export { useCanvasDrop };
```

Notes:

- `useMutation` from `@liveblocks/react/suspense` is the suspense form, matching the existing `useLiveblocksFlow({ suspense: true })` usage in `canvas-room.tsx`.
- `useReactFlow()` must be called inside a `<ReactFlowProvider>` — the hook is called from inside `<Canvas>` (which renders inside the provider), so this works.
- The `LiveObject` envelope is required by Liveblocks' storage API — plain objects can't be `.set()` into a `LiveMap` because they aren't Live structures.
- `origin: [0.5, 0.5]` centers the node on the drop point, so the cursor lands on the node's center, not its top-left.
- The try/catch and the `isShapeDefinition` guard prevent malformed payloads (or drops from non-panel sources) from crashing the canvas.

## Files to Modify

### `components/editor/canvas/canvas-room.tsx`

Five surgical changes inside the existing `<Canvas />` component (lines 47-78):

1. Import `useReactFlow` (not used here directly — `useCanvasDrop` handles that), `CanvasNode`, `ShapePanel`, and `useCanvasDrop`.
2. Call `const drop = useCanvasDrop();` inside the function body.
3. Add `const nodeTypes = { [canvasNode]: CanvasNode } as const;` above the function.
4. Pass `nodeTypes={nodeTypes}` to `<ReactFlow>` and make `useLiveblocksFlow` generic over `CanvasNode`/`CanvasEdge` for type safety: `useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })`.
5. Wrap the existing `<ReactFlow>` in a `<div className="relative h-full w-full" onDragOver={drop.onDragOver} onDrop={drop.onDrop}>` and render `<ShapePanel />` as a sibling inside the provider (sits on top via `fixed` positioning). Drop handlers go on the outer div, not on `<ReactFlow>` itself — React Flow listens to those events for its own node-drag behavior.

### `components/editor/index.ts`

Add the two new component exports so the existing barrel stays the single import surface:

```ts
export { CanvasNode, type CanvasNodeProps } from "./canvas/canvas-node";
export { ShapePanel } from "./canvas/shape-panel";
```

### `liveblocks.config.ts`

Extend the `Storage` interface to declare the `flow` `LiveObject` shape so the new `useMutation` in `useCanvasDrop` typechecks against the room's storage tree:

```ts
import { LiveMap, LiveObject } from "@liveblocks/client";
import type { CanvasNode, CanvasEdge } from "./types/canvas";

// In the Liveblocks declaration:
Storage: {
  flow: LiveObject<{
    nodes: LiveMap<string, LiveObject<CanvasNode>>;
    edges: LiveMap<string, LiveObject<CanvasEdge>>;
  }>;
}
```

The shape is what `useLiveblocksFlow` stores under the default `storageKey: "flow"` (confirmed in `node_modules/@liveblocks/react-flow/dist/index.d.ts:106-109`). Without this declaration, `storage.get("flow")` is typed as `any` in the mutation body, which violates the project's no-`any` rule.

## Critical Files

- `D:\code\build-with-claude-code\ghost-ai\components\editor\canvas\canvas-room.tsx` — add nodeTypes, drop handlers, panel mount
- `D:\code\build-with-claude-code\ghost-ai\components\editor\canvas\canvas-node.tsx` (new) — custom node renderer
- `D:\code\build-with-claude-code\ghost-ai\components\editor\canvas\shape-panel.tsx` (new) — drag-source toolbar
- `D:\code\build-with-claude-code\ghost-ai\lib\canvas\shape-definitions.ts` (new) — shape data, MIME, ID gen
- `D:\code\build-with-claude-code\ghost-ai\hooks\use-canvas-drop.ts` (new) — drop handler + Liveblocks mutation
- `D:\code\build-with-claude-code\ghost-ai\liveblocks.config.ts` — extend Storage shape
- `D:\code\build-with-claude-code\ghost-ai\components\editor\index.ts` — barrel exports

## Reused Utilities

- `NODE_COLORS`, `DEFAULT_NODE_COLOR`, `canvasNode`, `CanvasNodeData`, `CanvasNode`, `CanvasEdge` — all from `types/canvas.ts` (already the source of truth for the canvas domain)
- `Button` styling tokens (`bg-elevated`, `border-surface-border`, `rounded-3xl`, `text-copy-secondary`, `bg-subtle`, `text-copy-primary`) — from `app/globals.css`
- `useMutation` from `@liveblocks/react/suspense` (already a dependency)
- `useReactFlow` from `@xyflow/react` v12 (already a dependency)

## Verification

1. **Typecheck + lint + build** (the spec's explicit "Check When Done"):
   ```
   bun run typecheck
   bun run lint
   bun run fmt:check
   bun run build
   ```
2. **Live smoke test** (manual, against a real room):
   - Open a project, confirm the pill toolbar appears at the bottom-center of the canvas.
   - Drag each of the 6 shapes onto the canvas; verify each renders as a bordered rectangle with the dragged dimensions, centered on the drop point, with an empty label and neutral dark fill.
   - In a second tab (with the same project + a collaborator invite), confirm dropped nodes appear in the other tab in real time — proves the `useMutation` is writing to Liveblocks Storage, not local state.
   - Drag 3 rectangles in quick succession; confirm the IDs follow the `rectangle-{ts}-{counter}` pattern with counter incrementing.
   - Pan and zoom the canvas; verify the new nodes scale with the viewport (they should, since width/height are in canvas space).
   - Connect two dropped nodes with an edge to confirm the `Handle` components work and edges attach as expected.
   - Drop outside the canvas wrapper (e.g. on the navbar or sidebar) — should be a no-op.
3. **Payload sanity check** (one-time, during development): add a `console.log` of the parsed payload inside `onDrop`, then remove after confirming the drag payload is `{ name, width, height }` for the dragged shape.
