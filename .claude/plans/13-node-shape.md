# Plan: Spec 13 — Node shape rendering & drag preview

## Context

Spec 13 (`.claude/context/specs/13-node-shape.md`) covers two related concerns:

1. **Replace the placeholder node renderer** with proper shape rendering and selection styling.
2. **Add a shape drag preview** that follows the cursor while dragging from the shape panel.

The first concern is **already done** in the canvas hardening pass (see `progress-tracker.md` → "In Progress → Canvas hardening, first pass"). `components/editor/canvas/canvas-node.tsx` already implements the full 6-shape vocabulary:

- CSS shapes (rectangle, pill, circle) via a single `<div>` whose `border-radius` defines the silhouette.
- SVG shapes (diamond, hexagon, cylinder) via inline `<svg>` with `viewBox="0 0 100 100"`, `preserveAspectRatio="none"`, `vectorEffect="non-scaling-stroke"` so they stretch to any payload size without distorting the stroke.
- Selection visual already uses the canonical pattern: `var(--border-default)` (#201e18) at rest, `var(--text-primary)` (#eeeeee) + 2px `var(--accent-primary-dim)` glow halo when selected (CSS shapes use `box-shadow`; SVG shapes use `filter: drop-shadow(...)`).
- `data.shape` is the sole discriminator; `data.color` and `selected` are the only other inputs. No local state, no effects, no remount keys.
- Connection handles (`top`/`left` target, `right`/`bottom` source) and `NodeResizer` (with per-shape `RESIZE_MIN` floors; circle keeps aspect ratio) are already gated on `selected`.
- Node rendering is connected to the live canvas state — `useLiveblocksFlow` writes `position`/`dimensions` on change; `useCanvasDrop` writes the initial `LiveObject.from(node)` insert; the renderer is registered as `nodeTypes = { [canvasNode]: CanvasNodeRenderer }` in `canvas-room.tsx`.

**What is genuinely missing** is the second concern: the drag preview. Currently the shape panel uses the browser's **default native ghost image** (a faded snapshot of the dragged button). The spec wants a custom ghost that:

- Matches the shape type and default size of what will be dropped.
- Follows the cursor.
- Hides on drop or drag cancel (Esc).

## Approach

Add a single new component (`ShapeDragPreview`) and a single new hook (`useShapeDragPreview`) that wire into the existing drag pipeline. The shape panel and the drop hook stay untouched. The preview is a portal-rendered `<div>` positioned via `transform: translate3d(x, y, 0)` updated on each `dragover`.

### Files to add

- **`components/editor/canvas/shape-drag-preview.tsx`** — presentational. Renders the 6 shape silhouettes (CSS or SVG) at the dragged shape's `width` × `height`, default `--border-default` border, neutral `NODE_COLORS[0]` fill, 50% opacity so the cursor remains visible underneath. No pointer events. Fixed `pointer-events-none` so it never intercepts the drop target. Uses `react-dom`'s `createPortal` to render at `document.body` so it's not clipped by the canvas wrapper's stacking context. Adds `useSyncExternalStore`-style positions or simple `useEffect` to subscribe to the global drag state.

- **`hooks/use-shape-drag-preview.ts`** — owns the drag state: `{ shape: ShapeDefinition | null, x: number, y: number }`. Three listeners wired on `document`:
  - `dragstart` on the shape panel buttons (read `SHAPE_DRAG_MIME` payload from `event.dataTransfer`) → set `shape`.
  - `dragover` on `document` → update `x, y` from `event.clientX/Y`. Throttled to `requestAnimationFrame` (single in-flight update per frame; cheap).
  - `dragend` on `document` → clear `shape` (fires on both drop and Esc).
  - Falls back to `mousemove` if `dragover` doesn't fire reliably (some browsers throttle it outside drop targets). `dragover` fires constantly inside a drop target, but stops firing the moment the cursor leaves the page; `mousemove` is the safety net for that edge case.

  Returns the current `{ shape, x, y }` to be consumed by `ShapeDragPreview`.

### Files to modify

- **`components/editor/canvas/canvas-room.tsx`** — mount `<ShapeDragPreview />` as a sibling of `<ReactFlow>`. No new wiring needed on the drop side: the existing `useCanvasDrop.onDrop` still fires on the canvas wrapper; the new preview hides on `dragend` (which fires after a successful drop, because the browser ends the drag operation).

- **`components/editor/index.ts`** — add `ShapeDragPreview` to the barrel.

### What does NOT change

- **`components/editor/canvas/canvas-node.tsx`** — already done. No edits.
- **`components/editor/canvas/shape-panel.tsx`** — stays a stateless drag source. The `onDragStart` payload is the same; the preview hook reads it off the `dataTransfer` via the custom MIME slot.
- **`hooks/use-canvas-drop.ts`** — no edits. Drop still reads `SHAPE_DRAG_MIME`, still creates the node, still centers on cursor.
- **`lib/canvas/shape-definitions.ts`** — no edits. `SHAPES` is the single source of truth for both the drop target and the preview.
- **`types/canvas.ts`** — no edits.

### Reused existing code

- `SHAPES` + `SHAPE_DRAG_MIME` from `lib/canvas/shape-definitions.ts` — both the drop hook and the preview hook read from the same `SHAPE_DRAG_MIME` slot.
- `NODE_COLORS[0]` (neutral pair) from `types/canvas.ts` — the default preview fill, matching the drop's `DEFAULT_NODE_COLOR`.
- `CSS_SHAPE_RADIUS` map and the inline SVG paths for diamond/hexagon/cylinder are **copied** from `canvas-node.tsx` into the preview component. They are 6 small values (one map + 2-3 SVG paths); extracting a shared `lib/canvas/shape-rendering.tsx` would be over-abstraction for two consumers. The comment header in both files notes the duplication.

### Why a portal + global listeners, not a per-button preview

The shape panel buttons are in a different stacking context from the canvas. A portal at `document.body` guarantees the preview isn't clipped or hidden by ancestors (e.g. by the panel's `bg-elevated/95 backdrop-blur-md`). Global `dragover`/`dragend` listeners are the standard HTML5 way to drive a custom preview because the browser's native ghost image is otherwise opaque and unreplaceable from outside the drag source.

## Critical files

| Concern         | File                                              | Action                     |
| --------------- | ------------------------------------------------- | -------------------------- |
| Preview visuals | `components/editor/canvas/shape-drag-preview.tsx` | **new**                    |
| Preview state   | `hooks/use-shape-drag-preview.ts`                 | **new**                    |
| Canvas mount    | `components/editor/canvas/canvas-room.tsx`        | **modify** — mount preview |
| Barrel          | `components/editor/index.ts`                      | **modify** — re-export     |

No new dependencies. `react-dom` is already a dep for the portal.

## Verification

1. **Static gates** (per the project's standard): `bun run typecheck` exits 0, `bun run lint` (oxlint) exits 0, `bun run fmt:check` clean on changed files, `bun run build` exits 0.
2. **Live smoke matrix** (matches the spec's "Check When Done" section):
   - Drag each of the 6 shapes from the panel: the preview appears under the cursor, matches the dragged shape's silhouette and default size, follows the cursor smoothly (no jitter, no lag from missed `dragover` ticks).
   - Drop on an empty canvas area: preview disappears, a new node appears at the drop point with the same shape/size (drop hook behavior already verified in spec 12).
   - Drag off the panel and release outside the canvas (e.g. into the navbar): preview disappears, no node created.
   - Press Esc mid-drag: preview disappears, no node created.
   - Drop over the shape panel itself: preview disappears, no node created.
   - Re-render existing nodes: the 6 shapes still render correctly with subtle borders at rest and brighter borders + glow when selected (canvas hardening regression check).
   - Two-client collaborative matrix (already pending in `progress-tracker.md`): the preview is a single-client UI affordance — does not affect the live node graph — so this just re-runs the existing matrix.
3. **No regressions in spec 12 drop behavior**: `useCanvasDrop` is unchanged, the `SHAPE_DRAG_MIME` payload is unchanged, so the drop → create-node path is identical.
