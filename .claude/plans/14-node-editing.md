# Plan — Spec 14: Node Editing (Inline Label Edit)

## Context

Spec 14 (`/specs/14-node-editing.md`) adds **inline label editing** to the collaborative canvas nodes. The resize portion is already in place from spec 13 (canvas hardening) — `NodeResizer` is mounted with per-shape min sizes, visible only when selected, and dimensions flow through `onNodesChange` → `useLiveblocksFlow` → Liveblocks Storage.

The only net-new functionality is the label editor. The label is currently a static `<span>` in both the CSS and SVG render branches of `canvas-node.tsx`. The plan introduces:

- A new `useCanvasLabelEdit` hook (matching the `use-canvas-drop` / `use-canvas-delete` convention) that owns the local `isEditing` state and the `useMutation` that writes `data.label` back into the Liveblocks `flow` LiveObject.
- A native `<textarea>` swap-in for the static span in both render branches, with `nodrag nopan` classes so React Flow's drag/pan gestures don't steal text input.
- `onDoubleClick` on the static label span to enter edit mode.
- One prop addition (`zoomOnDoubleClick={false}`) on `<ReactFlow>` so double-clicking empty canvas doesn't zoom and conflict with the new double-click-to-edit UX.

No new dependencies, no changes to `types/canvas.ts`, `lib/canvas/shape-definitions.ts`, `components/editor/canvas/shape-panel.tsx`, or any `components/ui/*` file (protected foundation). The new hook is internal — not added to `components/editor/index.ts`.

## File Map

| File                                       | Action                               |
| ------------------------------------------ | ------------------------------------ |
| `hooks/use-canvas-label-edit.ts`           | **NEW** (~70 lines)                  |
| `components/editor/canvas/canvas-node.tsx` | MODIFY — imports + 2 render branches |
| `components/editor/canvas/canvas-room.tsx` | MODIFY — one prop on `<ReactFlow>`   |
| `components/editor/index.ts`               | **no change**                        |

## 1. `hooks/use-canvas-label-edit.ts` (NEW)

### Signature

```ts
type UseCanvasLabelEditArgs = { nodeId: string };
function useCanvasLabelEdit({ nodeId }: UseCanvasLabelEditArgs): {
  isEditing: boolean;
  onStartEdit: () => void;
  onChange: (next: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};
```

### Mutation body

Mirrors the `storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>` cast from `hooks/use-canvas-drop.ts` (lines 46-75) — the global `Liveblocks.Storage: {}` interface intentionally doesn't model the canvas graph. Local types `LsonNodeRecord` / `CanvasFlowLive` are defined in this file (same precedent as the drop hook).

```ts
const setLabel = useMutation(
  ({ storage }, next: string) => {
    const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
    const node = flow.get("nodes").get(nodeId);
    if (!node) return; // deleted concurrently → no-op
    const data = node.get("data") as unknown as LiveObject<CanvasNodeData> | undefined;
    if (!data) return;
    if (data.get("label") === next) return; // skip no-op CRDT writes
    data.set("label", next); // granular per-key set
  },
  [nodeId],
);
```

`data.set("label", next)` is granular CRDT (per-character ops); `node.set("data", { ...existing, label })` is the whole-object alternative. Spec says "update as user types" — granular is the right shape and the `useMutation` batches per event-loop turn anyway.

### Imports

```ts
import { useCallback, useState } from "react";
import { useMutation } from "@liveblocks/react/suspense";
import { LiveMap, LiveObject } from "@liveblocks/client";

import type { CanvasNodeData } from "@/types/canvas";
```

Use the `@liveblocks/react/suspense` variant — matches `use-canvas-drop.ts` and the `ClientSideSuspense` boundary in `canvas-room.tsx`.

### Header comment

```ts
// Spec: .claude/context/specs/14-node-editing.md
```

(Plus a doc block explaining the uncontrolled-input rationale: the textarea seeds from `data.label` on each edit open via `defaultValue`; we never mirror to local state because that would lose cross-client edits mid-typing.)

### Edge cases handled

- `nodeId` undefined → typed as required string; React Flow always provides `id`.
- Mutation fires while editing is closing → independent of `setIsEditing(false)`; the value is persisted either way.
- User types and blurs simultaneously → React fires `change` before `blur`; the last `onChange` is committed before `onCommit`.
- Concurrent delete → `flow.get("nodes").get(nodeId)` returns `undefined` → safe no-op.
- Two clients editing the same node → CRDT last-writer-wins per `data.set`; spec doesn't require true collaborative caret.

## 2. `components/editor/canvas/canvas-node.tsx` (MODIFY)

### Imports to add

```ts
import { useEffect, useRef } from "react";

import { useCanvasLabelEdit } from "@/hooks/use-canvas-label-edit";
```

### Inside `CanvasNodeComponent` (after the existing destructure)

Add `id` to the destructure (already part of `NodeProps<CanvasNode>`), then:

```ts
const { isEditing, onStartEdit, onChange, onCommit, onCancel } = useCanvasLabelEdit({
  nodeId: id,
});
const textareaRef = useRef<HTMLTextAreaElement | null>(null);

useEffect(() => {
  if (!isEditing) return;
  const el = textareaRef.current;
  if (!el) return;
  el.focus();
  el.select(); // overwrite on first keystroke
}, [isEditing]);
```

Append a paragraph to the existing header doc-comment (under `// Resizing:`) describing the label-editing flow.

### CSS branch (line 110) — replace the static span

Replace:

```tsx
<span className="select-none">{data.label}</span>
```

With conditional render — a `<textarea>` when editing, otherwise a `<span>` (with `text-copy-muted` placeholder text when empty):

```tsx
{
  isEditing ? (
    <textarea
      ref={textareaRef}
      defaultValue={data.label}
      rows={1}
      placeholder="Label"
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      // `nodrag` stops the node-drag gesture from stealing the mousedown;
      // `nopan` stops the canvas pan from the same. Both are the
      // @xyflow/react v12 defaults (see `noDragClassName` /
      // `noPanClassName` in the package's component props).
      className="nodrag nopan w-[80%] resize-none bg-transparent text-center text-xs outline-none placeholder:text-copy-muted"
    />
  ) : (
    <span
      className={data.label ? "select-none" : "select-none text-copy-muted"}
      onDoubleClick={onStartEdit}
    >
      {data.label || "Label"}
    </span>
  );
}
```

`nodrag nopan` are the `@xyflow/react` v12 defaults (`noDragClassName: "nodrag"`, `noPanClassName: "nopan"` — confirmed in `node_modules/@xyflow/react/dist/esm/index.mjs` line 278). No React Flow prop changes needed.

### SVG branch (lines 212-219) — replace the static span

Replace:

```tsx
<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
  <span className="max-w-[80%] text-center text-xs select-none" style={{ color: colorPair.text }}>
    {data.label}
  </span>
</div>
```

With:

```tsx
<div className="absolute inset-0 flex items-center justify-center">
  {isEditing ? (
    <textarea
      ref={textareaRef}
      defaultValue={data.label}
      rows={1}
      placeholder="Label"
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className="nodrag nopan w-[80%] max-w-[80%] resize-none bg-transparent text-center text-xs outline-none placeholder:text-copy-muted"
      style={{ color: colorPair.text }}
    />
  ) : (
    <span
      className={
        "max-w-[80%] text-center text-xs select-none " + (data.label ? "" : "text-copy-muted")
      }
      style={{ color: data.label ? colorPair.text : undefined }}
      onDoubleClick={onStartEdit}
    >
      {data.label || "Label"}
    </span>
  )}
</div>
```

Drop the wrapper's `pointer-events-none` so the static span can receive `onDoubleClick`. The textarea has `nodrag nopan` so drag/pan are still skipped; the Resize handles (absolutely positioned by `NodeResizer`) sit at the corners and don't fight with the centered label.

### Why these class strings

- `w-[80%] max-w-[80%]` — matches the static span's width so switching modes doesn't shift layout (spec: "smooth editing without causing layout shifts").
- `resize-none` — no manual drag-resize handle on the textarea itself.
- `bg-transparent outline-none` — no white box, no native focus ring competing with the node's selected-border glow.
- `placeholder:text-copy-muted` — same token used in `rename-project-dialog.tsx` / `create-project-dialog.tsx` for empty-state placeholders.
- `rows={1}` — fixed-height, single line; auto-grow is out of scope for this spec.

### Color inheritance

- The textarea has no `text-copy-*` class. It inherits `color: colorPair.text` from the parent (CSS branch) or its own `style` (SVG branch) — matches the static label's color treatment.
- Placeholder is `text-copy-muted` via Tailwind's placeholder pseudo-class override.

## 3. `components/editor/canvas/canvas-room.tsx` (MODIFY)

One prop addition on `<ReactFlow>` (lines 85-104):

```tsx
<ReactFlow
  …
  zoomOnDoubleClick={false}
  …
>
```

Default `zoomOnDoubleClick={true}` causes double-clicking empty canvas to zoom in, fighting the new double-click-to-edit UX. The `MiniMap` zoom controls and `Controls` are unaffected. No other ReactFlow props change, no imports change.

## 4. `components/editor/index.ts` — NOT MODIFIED

The hook is internal to `canvas-node.tsx`. Adding a barrel export would violate the surgical-changes rule. The `CanvasNode` / `CanvasNodeProps` public exports are unchanged (prop signature `NodeProps<CanvasNode>` is identical).

## Implementation Order

1. Write `hooks/use-canvas-label-edit.ts` (new).
2. Edit `components/editor/canvas/canvas-node.tsx` — imports + `id` in destructure + hook call + `ref` + `useEffect` + patch both render branches + append doc-comment paragraph.
3. Edit `components/editor/canvas/canvas-room.tsx` — add `zoomOnDoubleClick={false}`.
4. Run `bun run build` per the spec's Check-When-Done bullet.

## Verification

Static gates:

- `bun run typecheck` (tsc --noEmit) — exits 0
- `bun run lint` (oxlint) — exits 0
- `bun run fmt:check` (oxfmt) — clean on all changed files
- `bun run build` — exits 0 with no type errors

Spec checklist:

- [x] Selected nodes show resize handles — already done (spec 13).
- [x] Resizing updates node dimensions through the existing node state flow — already done.
- [x] Double-clicking a node opens inline label editing — `onDoubleClick={onStartEdit}` on the static span, `useEffect` focuses the textarea on `isEditing` flip.
- [x] Label editing updates node labels through the existing sync flow — `useMutation` writes to the same `flow` LiveObject as `useCanvasDrop`.
- [x] Editing closes on blur or Escape — `onBlur={onCommit}` + `onKeyDown` Escape handler.
- [x] Text interactions do not trigger canvas drag or pan — `nodrag nopan` on the textarea; `useCanvasDelete` already special-cases `textarea` for Backspace.
- [x] `bun run build` passes without type errors.

End-to-end smoke test (manual, not in this spec's scope but part of the two-client canvas collab matrix per progress-tracker.md "Next Up"):

1. Drop a node of any shape — it appears with no label.
2. Double-click the centered label area — textarea opens, focused, content selected, placeholder shows "Label" in muted color.
3. Type a label — changes propagate to a second connected client via Liveblocks CRDT.
4. Press Escape — editing closes; last-typed value persists.
5. Click outside (blur) — same close behavior; last-typed value persists.
6. Inside the textarea, press Backspace — does NOT delete the node (skipped by `useCanvasDelete`'s `target?.closest('input, textarea, [contenteditable="true"]')` check).
7. Click and drag on the textarea — does NOT initiate a node drag (`nodrag` class).
8. Click the empty canvas and double-click — does NOT zoom in (new `zoomOnDoubleClick={false}`).

## Pattern References (for the implementer)

- `hooks/use-canvas-drop.ts` (lines 46-75) — `storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>` cast + `useMutation` body shape.
- `hooks/use-canvas-delete.ts` (line 57) — `target?.closest('input, textarea, [contenteditable="true"]')` skip-keyboard precedent.
- `components/editor/canvas/canvas-node.tsx` lines 36-41 — existing header doc-comment; append the label-editing paragraph in the same style.
- `node_modules/@xyflow/react/dist/esm/index.mjs` line 278 — `noPanClassName: 'nopan'` default (and `noDragClassName: 'nodrag'`).
- `app/globals.css` line 59 — `text-copy-muted` token used for empty-state placeholders.
- `.claude/context/specs/14-node-editing.md` — target spec.

## Risks / Open Questions

1. **Concurrent label editing by two clients** — last-writer-wins per CRDT key. Spec doesn't require real-time merge; a follow-up spec could use a Yjs text binding inside `CanvasNodeData` if needed.
2. **Multi-line labels** — textarea is `rows={1}` and does not auto-grow. Long labels horizontally scroll inside `w-[80%]`. Spec says "smooth editing without causing layout shifts" — single line is the conservative reading. Follow-up could swap to `contenteditable` with auto-resize.
3. **Accessibility** — `aria-label="Label"` on the textarea would be a small improvement but is not in the spec.
4. **Auto-suggested `autoFocus` vs `useEffect` + `ref.current?.select()`** — chose the latter so an existing label gets selected (single keystroke replaces it). Matches Figma/Excalidraw behavior.
