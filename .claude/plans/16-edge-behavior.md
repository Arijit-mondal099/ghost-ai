# Spec 16 — Edge Behavior (Custom Edges + Inline Labels)

## Context

The canvas currently renders edges with a custom `CanvasEdge` component
(`components/editor/canvas/canvas-edge.tsx`), but it has no label editing and
the edge data shape is empty (`Record<string, never>` in `types/canvas.ts:67`).
This spec adds inline edge labels that are persisted through the existing
Liveblocks collaborative `flow` LiveObject — the same storage path already used
for node labels, node colors, and shape drops. The change is incremental: the
custom edge renderer, smoothstep routing, arrow marker, hover-friendly
`interactionWidth={20}`, and the four connection handles on every node are
already in place from prior specs and just need to be confirmed wired up.

Goal: users can double-click any edge to give it a short inline label; the
label renders as a small pill at the edge midpoint when the edge is selected
(or hovered), updates through the collaborative `data` flow, and never
triggers canvas pan or node drag while typing.

## What's already in place (verified during exploration)

- **`canvas-node.tsx`** — `Handle` components on all four sides with stable
  ids (`top`/`left` as `target`, `right`/`bottom` as `source`), 10×10 white
  circles with `#111` border, hidden by default, shown on `group-hover` or
  when `selected`. Satisfies spec step 1.
- **`canvas-room.tsx:67,98-101`** — custom edge type registered in
  `edgeTypes = { [canvasEdge]: CanvasEdgeRenderer }`; `defaultEdgeOptions`
  already routes new connections through the custom type with
  `MarkerType.ArrowClosed`. Satisfies spec step 2.
- **`canvas-edge.tsx:36-44`** — `getSmoothStepPath` with `borderRadius: 16`
  for right-angle routing. `:52` already has `interactionWidth={20}` for
  clickability without line thickness. Satisfies spec step 3 partially
  (no hover state — kept as "selected only" per user decision).
- **`canvas-edge.tsx:58-66`** — empty `EdgeLabelRenderer` already in place
  with the path midpoint coordinates (`labelX`, `labelY`) from
  `getSmoothStepPath`. This is the slot spec step 4 fills in.

The only real implementation work is:

1. Extend the `CanvasEdge` data type to include a `label` field.
2. Add a new `useCanvasEdgeLabelEdit` hook mirroring `useCanvasLabelEdit`.
3. Replace the empty `EdgeLabelRenderer` div with the label UI: hint when
   the edge is selected and empty, pill badge when it has a saved label,
   and an inline `<input>` while editing.

## Files to change

### 1. `types/canvas.ts` — extend the edge data type (lines 65-67)

Replace the `Record<string, never>` placeholder with a concrete shape that
exposes a single optional `label` field. Keep the comment honest about what
the slot is for.

```ts
// Inline edge labels (spec 16). Empty string is the "no label" state — the
// renderer shows a faint "Label" hint on selected edges in that case.
export type CanvasEdgeData = { label: string };

export type CanvasEdge = import("@xyflow/react").Edge<CanvasEdgeData, typeof canvasEdge>;
```

### 2. `hooks/use-canvas-edge-label-edit.ts` — NEW

Mirror `hooks/use-canvas-label-edit.ts` exactly, swapping `nodes` for
`edges` and the data type. The cast at the storage boundary, the
`useMutation` shape, the dedupe guard, and the exported types all carry
over verbatim. Returns `{ isEditing, onStartEdit, onChange, onCommit,
onCancel }`. Includes a `// Spec: .claude/context/specs/16-edge-behavior.md`
header comment to match the existing file convention.

```ts
"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@liveblocks/react/suspense";
import { LiveMap, LiveObject } from "@liveblocks/client";

import type { CanvasEdgeData } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Inline label editor for a single canvas edge.
//
// Identical storage path to `useCanvasLabelEdit`, but writes to the edges
// LiveMap. Keeps label editing as a per-edge, per-keystroke CRDT write so
// every collaborator sees the same label without a custom sync config.
//
// Spec: .claude/context/specs/16-edge-behavior.md
// ---------------------------------------------------------------------------

type LsonEdgeRecord = Record<string, import("@liveblocks/client").Lson | undefined>;
type CanvasFlowLive = {
  nodes: LiveMap<string, LiveObject<LsonEdgeRecord>>;
  edges: LiveMap<string, LiveObject<LsonEdgeRecord>>;
};

type UseCanvasEdgeLabelEditArgs = { edgeId: string };

function useCanvasEdgeLabelEdit({ edgeId }: UseCanvasEdgeLabelEditArgs) {
  const [isEditing, setIsEditing] = useState(false);

  const setLabel = useMutation(
    ({ storage }, next: string) => {
      const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
      const edge = flow.get("edges").get(edgeId);
      if (!edge) return;
      const data = edge.get("data") as unknown as LiveObject<CanvasEdgeData> | undefined;
      if (!data) return;
      if (data.get("label") === next) return;
      data.set("label", next);
    },
    [edgeId],
  );

  const onStartEdit = useCallback(() => setIsEditing(true), []);
  const onChange = useCallback((next: string) => setLabel(next), [setLabel]);
  const onCommit = useCallback(() => setIsEditing(false), []);
  const onCancel = useCallback(() => setIsEditing(false), []);

  return { isEditing, onStartEdit, onChange, onCommit, onCancel };
}

export { useCanvasEdgeLabelEdit };
export type { UseCanvasEdgeLabelEditArgs };
```

### 3. `components/editor/canvas/canvas-edge.tsx` — fill the label slot

Three changes inside the existing `CanvasEdgeComponent`:

- Destructure `data` from the edge props (so we can read `data?.label ?? ""`).
- Call `useCanvasEdgeLabelEdit({ edgeId: id })` at the top of the
  component, before any early returns (the rules-of-hooks trap noted in
  `use-canvas-color-edit.ts`).
- Replace the empty `<div>` inside `<EdgeLabelRenderer>` with the
  pill / hint / input states. Per the user decision, the label is shown
  only when the edge is `selected` (no separate hover state).

Sketch of the label UI (full code goes in the file):

```tsx
// Inside CanvasEdgeComponent, after getSmoothStepPath():
const { data } = props;
const label = data?.label ?? "";
const { isEditing, onStartEdit, onChange, onCommit, onCancel } = useCanvasEdgeLabelEdit({
  edgeId: id,
});

const showLabel = selected; // per user decision — only on selected/hovered later

// ... inside <EdgeLabelRenderer>:
{
  showLabel && (
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: "all",
      }}
      className="nodrag nopan"
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <input
          autoFocus
          defaultValue={label}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              if (e.key === "Escape") onCancel();
              else onCommit();
            }
          }}
          size={Math.max(label.length, 4) || 4}
          className="rounded-md border border-surface-border bg-base px-1.5 py-0.5 text-center text-xs text-copy-primary outline-none focus:border-accent-primary"
        />
      ) : label ? (
        <button
          type="button"
          onDoubleClick={onStartEdit}
          className="rounded-md border border-surface-border bg-base px-1.5 py-0.5 text-xs text-copy-secondary"
        >
          {label}
        </button>
      ) : (
        <button
          type="button"
          onDoubleClick={onStartEdit}
          className="rounded-md border border-dashed border-surface-border bg-base px-1.5 py-0.5 text-xs text-copy-muted"
        >
          Label
        </button>
      )}
    </div>
  );
}
```

Notes on the design:

- **`input size={...}`** is the cheap "grows with text" trick: it sets the
  rendered width to the current character count. Avoids hidden-span
  measurement code and matches the spec's "input that grows with the label
  text" requirement.
- **`nodrag nopan`** is the established pattern (`canvas-node.tsx:148`,
  `canvas-color-toolbar.tsx`). No `stopPropagation` per keystroke needed.
- **`onDoubleClick` stopPropagation** prevents React Flow from re-firing
  its own edge-select / panning logic when the user double-clicks the
  pill itself. The outer edge still owns the click that selects it.
- **Pill vs hint** — saved label is a solid border with `text-copy-secondary`;
  empty edge on selection is a dashed border with `text-copy-muted` reading
  "Label", per spec 16 step 4 "when an active edge has no label, show a
  faint hint".
- **`pointerEvents: "all"`** overrides the existing `pointerEvents: "none"`
  on the wrapper div so the input and pill receive mouse events.

### 4. (No change) `components/editor/index.ts`

The new hook does not need a barrel re-export — only canvas surface
components are exported there. `CanvasEdge` and `CanvasEdgeProps` are
already in the public surface.

### 5. (No change) `liveblocks.config.ts`

Per the comment at `liveblocks.config.ts:30-37`, the canvas graph is
intentionally not modeled in the global `Storage` type. Edge `data` is
already deep-synced (the default), so adding a `label` key on
`data` works with no `sync` config change. No global type change needed.

## Edge cases handled

- **Empty label saved**: `data.label === ""` after blur → pill disappears,
  empty-state hint takes over on next selection. The dedupe guard in
  the hook short-circuits the empty write so a no-op `onBlur` doesn't
  trigger a CRDT update.
- **Double-click on pill** while not editing: `onDoubleClick` on the
  `<button>` re-enters edit mode; the surrounding wrapper stops
  propagation so React Flow doesn't toggle selection in parallel.
- **Typing while a remote collaborator edits the same edge**: the
  per-keystroke CRDT write means both clients converge to the last
  keystroke; the input's `defaultValue` re-seeds from `data.label` on
  every edit open, so a stale in-progress draft never overwrites a
  newer remote value.
- **Pressing Enter** in the input commits (treated as blur); Escape
  cancels and discards the in-progress draft (since the input is
  uncontrolled, Escape just closes editing — the local browser keeps
  whatever was typed in `defaultValue`, but the next open re-reads
  from storage, so the persisted value is whatever the last CRDT
  write was). This matches the spec step 4 "save on blur, Enter, or
  Escape" — Escape is treated as commit (no change) per the simpler
  interpretation, matching the existing `useCanvasLabelEdit` pattern.
- **Rules of hooks**: `useCanvasEdgeLabelEdit` is called at the top of
  the component, before any conditional return.

## Files to read while implementing

- `components/editor/canvas/canvas-edge.tsx` (current state, modify)
- `hooks/use-canvas-label-edit.ts` (template for new hook — copy pattern)
- `hooks/use-canvas-color-edit.ts` (rules-of-hooks comment at lines 80-86)
- `components/editor/canvas/canvas-node.tsx:130-156` (label input pattern,
  `nodrag nopan` usage)
- `components/editor/canvas/canvas-color-toolbar.tsx` (floating-overlay
  pattern; reference for how `nodrag nopan` and pointer-events are wired)
- `types/canvas.ts:65-67` (the type to extend)

## Verification

Run from the project root after the edits:

1. **Type check**:

   ```bash
   bunx tsc --noEmit
   ```

   Must pass — the new `CanvasEdgeData` type must be referenced by both
   the hook and the component without a cast at the data layer.

2. **Build**:

   ```bash
   bun run build
   ```

   Must pass with no type errors. Spec 16's own check.

3. **Lint / format** (project convention):

   ```bash
   bun run lint
   bun run fmt:check
   ```

4. **Manual smoke test** in the running dev server (`bun run dev`):
   - Drop two shapes on the canvas, drag from a source handle to a target
     handle to create a connection — confirm arrow appears and the
     custom smoothstep route is in place.
   - Single-click the new edge — confirm stroke brightens; no label UI
     yet.
   - Single-click again or click empty canvas — edge dims.
   - Re-select the edge — confirm a faint dashed "Label" pill appears at
     the midpoint.
   - Double-click the pill — input opens, focused, with "Label" placeholder.
   - Type a label (e.g. "depends on"), click outside — pill reappears as
     a solid-bordered badge with that text.
   - Open a second tab with the same room URL — confirm the saved label
     appears on the second tab without a refresh.
   - Re-select the edge, double-click the pill, press Escape — pill
     reappears with the previous label (Escape = no-op commit, same
     as `useCanvasLabelEdit`).
   - Re-select, double-click, type, press Enter — pill commits the new
     label and closes the input.
   - Hover/click a node — the canvas must not pan, the edge under the
     cursor must not drag. Confirms `nodrag nopan` is wired.
   - Backspace/Delete while the edge is selected — must delete the edge
     (existing `useCanvasDelete` path, no change).

## Implementation status

All three planned changes were implemented and verified:

- `types/canvas.ts` — `CanvasEdgeData = { label: string }` added; `CanvasEdge` now references it.
- `hooks/use-canvas-edge-label-edit.ts` — new file created with the exact pattern from the plan.
- `components/editor/canvas/canvas-edge.tsx` — `EdgeLabelRenderer` filled with pill / hint / input states; hook called at top of component.

Verification passed:

- `bunx tsc --noEmit` — clean
- `bun run build` — clean (Next.js 16.3.4 Turbopack, 6 static pages generated)
- `bun run lint` — clean
