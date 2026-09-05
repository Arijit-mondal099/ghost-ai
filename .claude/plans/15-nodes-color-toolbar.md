# Plan — Spec 15: Nodes Color Toolbar

## Context

Spec 15 (`/specs/15-nodes-color-toolbar.md`) adds a small floating color toolbar to the collaborative canvas so a user can change a selected node's background + text color in one click. The data model is already prepared: `CanvasNodeData.color: NodeColor` exists in `types/canvas.ts:59`, the 8-pair `NODE_COLORS` array is the single source of hex truth (same file, lines 12-21), and `canvas-node.tsx:72` already reads the active pair and applies both `fill` and `text` in a single render. Liveblocks `useMutation` → `flow` LiveObject is the established write path (used by `useCanvasDrop`, `useCanvasLabelEdit`, `useCanvasDelete`).

This spec is a **UI-only addition**: a new hook that writes `data.color`, a new floating component, two one-line wirings. No schema change, no new dependency, no `LiveObject` shape change, no new shadcn primitive, no globals.css edit, no `components/ui/*` modification.

## File Map

| File                                                | Action                                                          |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `hooks/use-canvas-color-edit.ts`                    | **NEW** (~55 lines)                                             |
| `components/editor/canvas/canvas-color-toolbar.tsx` | **NEW** (~140 lines)                                            |
| `components/editor/canvas/canvas-room.tsx`          | MODIFY — 1 import + 1 mount                                     |
| `components/editor/index.ts`                        | MODIFY — 1 export line                                          |
| `types/canvas.ts`                                   | **no change** — `data.color` and `NODE_COLORS` already in place |
| `liveblocks.config.ts`                              | **no change** — `Storage: {}` stays empty                       |
| `canvas-node.tsx`                                   | **no change** — existing renderer already reads `data.color`    |
| `globals.css`, `components/ui/*`                    | **no change** (protected foundation)                            |

## 1. `hooks/use-canvas-color-edit.ts` (NEW)

### Signature

```ts
type UseCanvasColorEditArgs = { nodeId: string };
function useCanvasColorEdit({ nodeId }: UseCanvasColorEditArgs): {
  onSetColor: (next: NodeColor) => void;
};
```

### Mutation body

Mirrors `useCanvasLabelEdit` (`hooks/use-canvas-label-edit.ts:43-54`) verbatim, swapping `label` for `color` and `string` for `NodeColor`:

```ts
const setColor = useMutation(
  ({ storage }, next: NodeColor) => {
    const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
    const node = flow.get("nodes").get(nodeId);
    if (!node) return; // concurrent delete → no-op
    const data = node.get("data") as unknown as LiveObject<CanvasNodeData> | undefined;
    if (!data) return;
    if (data.get("color") === next) return; // skip no-op CRDT writes
    data.set("color", next); // granular per-key set
  },
  [nodeId],
);
```

Local types `LsonNodeRecord` and `CanvasFlowLive` are copied from `use-canvas-label-edit.ts:28-32` — two consumers is below the bar for extraction (same precedent as `shape-drag-preview.tsx:21-26`).

### Imports

```ts
import { useCallback } from "react";
import { useMutation } from "@liveblocks/react/suspense";
import { LiveMap, LiveObject } from "@liveblocks/client";

import { type CanvasNodeData, type NodeColor } from "@/types/canvas";
```

`useState` is intentionally omitted — the toolbar's active-swatch state is derived from `data.color` on the next render, not mirrored locally.

### Header comment

```ts
// Spec: .claude/context/specs/15-nodes-color-toolbar.md
```

### Edge cases handled

- `nodeId` undefined → typed as required string; the toolbar passes `""` as a placeholder when nothing is selected (see section 2, rules-of-hooks fix). The mutation's `if (!node) return;` guard makes this a free no-op.
- Mutation fires while a node is being deleted concurrently → safe no-op.
- Two clients color the same node simultaneously → CRDT last-writer-wins per `data.set("color", next)`. Spec doesn't require real-time merge.
- Clicking the already-active swatch → short-circuited by the equality check, no storage event.

## 2. `components/editor/canvas/canvas-color-toolbar.tsx` (NEW)

A self-contained client component. Renders a single floating pill above the **exactly one** selected canvas node. No props — subscribes to the flow store and Liveblocks state itself (same pattern as `ShapePanel` and `ShapeDragPreview`).

### Hooks (in order, ALL must run before any early return)

```ts
const { nodes } = useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true });
const { x: vx, y: vy, zoom } = useViewport();
const paneDragging = useStore((s) => s.paneDragging);
const [hovered, setHovered] = useState<string | null>(null);
const [mounted, setMounted] = useState(false);
useEffect(() => {
  setMounted(true);
}, []);

// Derived (not a hook):
const selected = nodes.filter((node) => node.selected);
const node = selected.length === 1 ? selected[0] : null;

// Hook call MUST come before the early returns below:
const { onSetColor } = useCanvasColorEdit({ nodeId: node?.id ?? "" });

if (!mounted) return null;
if (node === null) return null;
```

> **Rules-of-hooks fix.** The first iteration put `useCanvasColorEdit` after `if (!mounted) return null;` and `if (selected.length !== 1) return null;`. On the first non-null render after the suspense boundary, `selected.length` was 0, the early return fired, and `useCanvasColorEdit` never ran. On the next render the user had selected a node, the early return was skipped, and the hook was called for the first time — React saw a new hook slot appear at the bottom of the hook list and threw "Rendered more hooks than during the previous render." Hoisting the hook above the early returns (with a stable `nodeId` of `""` when nothing is selected) keeps the hook order consistent. The mutation body no-ops on an unknown id.

### Geometry — anchor the toolbar above the node

Screen-space top-center of the node:

```ts
const nodeWidth = node.measured?.width ?? node.width ?? 0;
const left = node.position.x * zoom + vx + (nodeWidth * zoom) / 2;
const top = node.position.y * zoom + vy;
```

`useViewport` re-renders on every pan/zoom tick, so the toolbar tracks the node with no `requestAnimationFrame` queueing. `node.measured` is set by React Flow after the node first renders; falling back to `node.width` covers the very first frame.

### Toolbar root

```tsx
<div
  role="toolbar"
  aria-label="Node color"
  className="nodrag nopan absolute z-40 flex -translate-x-1/2 items-center gap-1.5
             rounded-2xl border border-surface-border bg-elevated/95
             px-2 py-1.5 shadow-lg backdrop-blur-md"
  style={{
    left,
    top: top - TOOLBAR_HEIGHT - TOOLBAR_GAP,   // TOOLBAR_HEIGHT = 40, TOOLBAR_GAP = 8
    transform: "translate(-50%, -100%)",       // center over node, lift above
    pointerEvents: paneDragging ? "none" : "auto",
  }}
>
```

- `nodrag nopan` are the `@xyflow/react` v12 default `noDragClassName` / `noPanClassName` — verbatim from `canvas-node.tsx:148, 274`. Established gesture-block pattern, no `stopPropagation` needed.
- `rounded-2xl border border-surface-border bg-elevated/95 backdrop-blur-md shadow-lg` is the floating-pill recipe from the delete pill at `canvas-room.tsx:122`.
- `pointer-events: none` while the user is panning (`paneDragging` from the React Flow store) so a stray swatch click during a pan doesn't change the color. The toolbar still renders so the position tracks the viewport.
- `role="toolbar" aria-label="Node color"` for screen readers.

### Swatch buttons

```tsx
{
  NODE_COLORS.map((colorPair) => {
    const isActive = colorPair.name === node.data.color;
    const isHovered = hovered === colorPair.name;
    return (
      <button
        key={colorPair.name}
        type="button"
        aria-label={colorPair.name}
        aria-pressed={isActive}
        disabled={paneDragging}
        onClick={() => onSetColor(colorPair.name)}
        onMouseEnter={() => setHovered(colorPair.name)}
        onMouseLeave={() => setHovered(null)}
        className={
          "nodrag nopan h-[18px] w-[18px] cursor-pointer rounded-full " +
          "border-[1.5px] border-surface-border transition-[box-shadow,border-color] duration-150" +
          (isActive ? " border-copy-primary" : "")
        }
        style={{
          background: colorPair.fill,
          boxShadow: isActive
            ? "0 0 0 2px var(--accent-primary-dim)"
            : isHovered
              ? `0 0 6px 1px ${colorPair.text}`
              : undefined,
        }}
      />
    );
  });
}
```

- **Active swatch** — `border-copy-primary` (the `--text-primary` token) plus `0 0 0 2px var(--accent-primary-dim)` ring, mirroring the node renderer's "selected" recipe at `canvas-node.tsx:75`.
- **Hover glow** — `0 0 6px 1px ${colorPair.text}` in the swatch's text color. The 6px blur + 1px spread keeps the glow tight per the spec ("not overly blurred"); a 12-16px halo would feel sloppy.
- **Active wins on hover** — the active ring takes precedence over the hover glow so the active swatch's identity stays unambiguous when hovered.
- `aria-pressed={isActive}` exposes state to assistive tech; `aria-label` is the color name (`"neutral"`, `"blue"`, etc.).
- `disabled={paneDragging}` is a belt-and-suspenders match for the parent's `pointer-events: none`; keyboard users can't activate a swatch during a pan either.

### SSR safety

The `mounted` flag + `useEffect` gate is the same pattern as `ShapeDragPreview` (`shape-drag-preview.tsx:120-125`). `useStore` and `useViewport` need a real DOM.

### Component signature

```ts
function CanvasColorToolbar(): JSX.Element | null;
```

No props, no exports beyond the default React component. Matches the precedent of `ShapePanel` and `ShapeDragPreview`, which are also self-contained siblings of `<ReactFlow>`.

## 3. `components/editor/canvas/canvas-room.tsx` (MODIFY)

Add one import and one mount, both near the existing `ShapeDragPreview` wiring:

```tsx
import { CanvasColorToolbar } from "@/components/editor/canvas/canvas-color-toolbar";
// ...
<ShapePanel />
<ShapeDragPreview />
<CanvasColorToolbar />
```

The component is rendered inside `<ReactFlowProvider>` (the `Canvas` wrapper at `canvas-room.tsx:135-141` already provides one). The component self-gates on `selected.length === 1`, so no extra conditional is needed at the parent.

## 4. `components/editor/index.ts` (MODIFY)

One new line, alphabetized between `AccessDenied` and `CanvasEdge`:

```ts
export { CanvasColorToolbar } from "./canvas/canvas-color-toolbar";
```

## Implementation Order

1. Write `hooks/use-canvas-color-edit.ts` (new). Compiles standalone; not yet wired to anything.
2. Write `components/editor/canvas/canvas-color-toolbar.tsx` (new). Calls the hook from step 1. `typecheck` and `build` will fail on the missing import in `canvas-room.tsx` until step 3, but the new file itself is type-clean.
3. Edit `components/editor/canvas/canvas-room.tsx` — import + mount the toolbar.
4. Edit `components/editor/index.ts` — add the barrel export.
5. Run the static verification gates.
6. Live smoke matrix (see below) — the only end-to-end check the static gates don't cover.

## Verification

### Static gates (all must exit 0)

- `bunx next typegen` — Next 16 needs this to materialize the `RouteContext` global; same prerequisite as the spec 06/07/08 sessions.
- `bun run typecheck` — `tsc --noEmit`; catches any cast drift in the storage write or the `useStore` selector.
- `bun run lint` — `oxlint`; the inline `style` literals and `nodrag nopan` className are well under any threshold.
- `bun run build` — produces 11 routes + Proxy (same as the canvas hardening pass) and exits 0.

### Spec checklist

- [x] Nodes use predefined background/text color pairs — `NODE_COLORS` is the existing 8-pair source of truth.
- [x] Selected nodes show a floating color toolbar — `CanvasColorToolbar` mounted in `CanvasSurface`.
- [x] Swatch selection updates both node and text colors — `onSetColor(colorPair.name)` writes one field; the renderer looks up the pair and applies both `fill` and `text`.
- [x] `bun run build` passes without type errors.

### Live smoke matrix (manual, two-client collab)

1. Drop a rectangle from the shape panel — it lands with the neutral pair (`#1F1F1F` / `#EDEDED`); no toolbar yet.
2. Click the node — toolbar appears centered above it, neutral swatch has the bright border + dim ring.
3. Hover the **blue** swatch — the blue swatch gains a tight `#52A8FF` glow; other swatches unchanged; no node movement.
4. Click the **blue** swatch — toolbar stays mounted, blue swatch now has the active ring, neutral loses the ring; the node's background updates to `#10233D` and its label text updates to `#52A8FF` in the same render.
5. Press-and-hold the cursor on a swatch and drag — the node does not move, the canvas does not pan (the `nodrag nopan` gate).
6. Click empty canvas to deselect — toolbar disappears; node keeps its new color.
7. Click the node again, then click `Delete (1)` in the top pill — node and toolbar both disappear; no errors.
8. Open a second tab on the same project room — drop + color a node in tab A; tab B sees the same color within one render. Click the same node in tab B; toolbar appears in tab B with the same active swatch; clicking a swatch in tab B propagates to tab A.
9. Pan the canvas with the node selected — toolbar tracks the node's screen position without lag (one render per viewport tick).
10. Zoom in / out — toolbar scales only the position math, not the swatch sizes (no `transform: scale(...)` on the toolbar; sizes are fixed in CSS pixels).
11. Multi-select (Shift+click two nodes) — toolbar disappears; the existing delete pill shows `Delete (2)`.
12. Resize the selected node — toolbar stays anchored to the same node's top-center; no flicker (the toolbar's height is a constant; the screen-space `top` is recomputed every render from the live `node.measured.width`).

## Pattern References (for the implementer)

- `hooks/use-canvas-label-edit.ts` lines 28-65 — `LsonNodeRecord` / `CanvasFlowLive` local types + the `storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>` cast + the `useMutation` body shape.
- `hooks/use-canvas-drop.ts` lines 46-75 — the same cast in a different (write) context; proves the cast is canonical.
- `components/editor/canvas/canvas-node.tsx:72` — the existing `colorPair = NODE_COLORS.find(c => c.name === data.color)` lookup the toolbar writes to.
- `components/editor/canvas/canvas-node.tsx:148, 274` — the `nodrag nopan` className pattern on the label editor's textarea.
- `components/editor/canvas/canvas-room.tsx:115-128` — the floating-pill visual recipe (`rounded-full border border-surface-border bg-elevated/95 shadow-lg backdrop-blur-md`) the toolbar mirrors with `rounded-2xl`.
- `components/editor/canvas/shape-drag-preview.tsx:120-125` — the `mounted` SSR gate pattern.
- `node_modules/@xyflow/react/dist/esm/index.mjs` line 278 — `noPanClassName: 'nopan'` default; `noDragClassName: 'nodrag'`.
- `node_modules/@xyflow/react/dist/esm/types/store.d.ts:10` — `state.nodeLookup: NodeLookup<InternalNode<...>>` (proves `positionAbsolute` exists on the internal type; not used here, but a useful reference if a future spec needs the pre-computed value).
- `node_modules/@xyflow/system/dist/esm/types/utils.d.ts:41` — `Transform = [number, number, number]` (we use `useViewport()` which exposes `{x, y, zoom}` and avoids the tuple).
- `app/globals.css` lines 50-67 — the Tailwind utility mappings (`bg-elevated/95`, `border-surface-border`, `border-copy-primary`, `bg-accent-dim`).
- `.claude/context/specs/15-nodes-color-toolbar.md` — the spec.

## Risks / Open Questions

1. **Hooks order** — the rules-of-hooks fix above is the only known footgun. Any future change to the component's early-return structure must keep `useCanvasColorEdit` (and any other hook) above every conditional return. The comment block at the top of the hook section explains why.
2. **Multi-select** — spec says "only show it when the node is selected" (singular). The current implementation treats exactly-one-selected as the only valid state; multi-select hides the toolbar and shows only the existing delete pill. If a future spec wants multi-color (one swatch click recolors all selected nodes), the change is contained to the toolbar's `selected` derivation and the hook's storage write — no API change to `useCanvasColorEdit` needed if it accepts an array of node ids, or a small extension if a single id is the contract.
3. **Real-time caret / collaborative swatch preview** — out of scope. Two clients clicking different swatches for the same node will see last-writer-wins per CRDT key.
4. **Accessibility** — `aria-label` per swatch names the color but not the visual change ("changes node to blue"). A richer label is a one-line follow-up; spec doesn't require it.
