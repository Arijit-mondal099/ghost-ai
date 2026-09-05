# Canvas Ergonomics: Control Bar + Keyboard Shortcuts

## Context

The collaborative canvas today has no zoom or history affordances on the canvas surface itself — zoom is locked to the initial `fitView` call and the only way to undo is to use Liveblocks' built-in browser undo, which most users don't know exists. The bottom-right of the canvas hosts a `MiniMap` that's mostly redundant with the shape panel for navigation. Spec 17 introduces two things:

1. A floating control bar at the **bottom-left** of the canvas with two groups — zoom (out / fit / in) and history (undo / redo) — separated by a divider.
2. A new `useKeyboardShortcuts` hook wired to the same actions, so the most common operations have keyboard shortcuts.

The intended outcome is that users can confidently pan/zoom/undo without leaving the canvas, and the new control bar's keyboard parity removes the need for the minimap as a navigation aid (the minimap is being removed in this spec).

## Critical files

- **NEW** `hooks/useKeyboardShortcuts.ts` — window `keydown` listener, mirrors the `useCanvasDelete` pattern.
- **NEW** `components/editor/canvas/canvas-control-bar.tsx` — the floating pill; sibling of the existing overlays.
- **EDIT** `components/editor/canvas/canvas-room.tsx` — mount the new control bar inside `CanvasSurface` (so it lives under `<ReactFlowProvider>` and inside `<RoomProvider>`); remove the `<MiniMap>`.
- **EDIT** `components/editor/index.ts` — export the new control bar from the editor barrel.

No new types. `types/canvas.ts` is unchanged.

## Reusable pieces already in the codebase

- `useReactFlow<CanvasNode, CanvasEdge>()` (`@xyflow/react`) — gives `zoomIn`, `zoomOut`, `fitView`, all with a built-in `duration` for animation. Already used in `hooks/use-canvas-delete.ts:27` and `hooks/use-canvas-drop.ts:63`.
- `useUndo`, `useRedo`, `useCanUndo`, `useCanRedo` (`@liveblocks/react`) — available but not yet imported anywhere. Must be called inside a `<RoomProvider>` (which `CanvasRoom` already provides via line 148). The canvas graph is owned by `@liveblocks/react-flow`'s `useLiveblocksFlow`, which is fully history-aware, so the Liveblocks history covers every node/edge/label/color change made through the existing `useMutation` hooks.
- The `closest('input, textarea, [contenteditable="true"]')` editable-field guard from `hooks/use-canvas-delete.ts:56` — exact pattern the spec asks for.
- The pill chrome established by the existing floating overlays:
  - Delete pill (`canvas-room.tsx:117-128`): `absolute top-4 left-1/2 z-40 -translate-x-1/2` with `rounded-full border border-surface-border bg-elevated/95 px-3 py-1.5 text-xs text-copy-secondary shadow-lg backdrop-blur-md`.
  - `ShapePanel` (`shape-panel.tsx:37`): `fixed bottom-6 left-1/2 z-40 -translate-x-1/2` — same chrome family.
  - `CanvasColorToolbar` (`canvas-color-toolbar.tsx:108`): `absolute z-40 ... rounded-2xl border border-surface-border bg-elevated/95 ... shadow-lg backdrop-blur-md`.
- `lucide-react` icons (e.g. `TrashIcon` already used at `canvas-room.tsx:19`) — new icons: `ZoomIn`, `ZoomOut`, `Maximize2`, `Undo2`, `Redo2`.
- The hooks directory conventions (from existing files): `"use client"` directive, named export only, `type UseXxxArgs = { ... }` declared before the function, file header docstring block with `Spec:` line, 70-column dash banner separator, 4-space indent, single quotes, semicolons.

## Implementation

### 1. `hooks/useKeyboardShortcuts.ts` (new)

Module docstring header (matching `use-canvas-delete.ts` style) and a `Spec: .claude/context/specs/17-canvas-ergonomics.md` line.

Signature:

```ts
type UseKeyboardShortcutsArgs = {
  reactFlow: ReactFlowInstance<CanvasNode, CanvasEdge> | null;
  onUndo: () => void;
  onRedo: () => void;
};
```

Body — single `useEffect` that:

- Attaches a `keydown` listener to `window` (matching the `useCanvasDelete` precedent at line 60).
- First guard: if `event.target.closest('input, textarea, [contenteditable="true"]')` returns a node, return.
- Pull `mod = event.metaKey || event.ctrlKey` once.
- Match the spec's exact keys:
  - `event.key === "+" || event.key === "="` (no mod required) → `reactFlow?.zoomIn({ duration: 200 })`, `preventDefault()`. Note: on a US keyboard `+` requires Shift, so accepting both is necessary; `=` is the unshifted key.
  - `event.key === "-"` (no mod required) → `reactFlow?.zoomOut({ duration: 200 })`, `preventDefault()`.
  - `mod && !event.shiftKey && event.key.toLowerCase() === "z"` → `onUndo()`, `preventDefault()`.
  - `mod && event.shiftKey && event.key.toLowerCase() === "z"` → `onRedo()`, `preventDefault()`.
  - `mod && event.key.toLowerCase() === "y"` → `onRedo()`, `preventDefault()`.
- Returns a cleanup that removes the same handler reference. Deps: `[reactFlow, onUndo, onRedo]`.

If `reactFlow` is `null`, the zoom handlers are a no-op (the spec calls the prop the React Flow instance; it's briefly null before `useReactFlow` resolves, so guard it).

No `useCallback` wrappers on `onUndo` / `onRedo` — the caller is expected to pass stable refs (the control bar will use `useCanUndo`/`useCanRedo` to guard, but the actual undo/redo functions from `useUndo`/`useRedo` are stable across renders).

### 2. `components/editor/canvas/canvas-control-bar.tsx` (new)

```ts
"use client";
```

Imports:

- `useReactFlow` from `@xyflow/react` (so we can pass the instance to the hook).
- `useCanUndo`, `useRedo`, `useCanRedo`, `useUndo` from `@liveblocks/react`.
- `ZoomIn`, `ZoomOut`, `Maximize2`, `Undo2`, `Redo2` from `lucide-react`.
- `useKeyboardShortcuts` from `@/hooks/use-keyboard-shortcuts`.
- `CanvasEdge`, `CanvasNode` from `@/types/canvas`.

Body:

- `const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();`
- `const undo = useUndo();` / `const redo = useRedo();`
- `const canUndo = useCanUndo();` / `const canRedo = useCanRedo();`
- Call `useKeyboardShortcuts({ reactFlow, onUndo: undo, onRedo: redo })` (must be called unconditionally; can't be moved after any early return).
- Button handlers:
  - `() => reactFlow.zoomIn({ duration: 200 })`
  - `() => reactFlow.zoomOut({ duration: 200 })`
  - `() => reactFlow.fitView({ duration: 200, padding: 0.1 })` (matching React Flow's default `fitView` padding used at `canvas-room.tsx:102`)
  - Undo / redo: just the `useUndo` / `useRedo` functions.

Markup (single root, matches the established pill chrome):

```tsx
<div className="nodrag nopan absolute bottom-6 left-6 z-40 flex items-center gap-1 rounded-full border border-surface-border bg-elevated/95 px-2 py-1.5 shadow-lg backdrop-blur-md">
  {/* zoom group */}
  <button
    type="button"
    onClick={zoomOut}
    title="Zoom out (-)"
    aria-label="Zoom out"
    className="flex h-7 w-7 items-center justify-center rounded-full text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary"
  >
    <ZoomOut className="h-3.5 w-3.5" />
  </button>
  <button
    type="button"
    onClick={fitView}
    title="Fit view"
    aria-label="Fit view"
    className="flex h-7 w-7 items-center justify-center rounded-full text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary"
  >
    <Maximize2 className="h-3.5 w-3.5" />
  </button>
  <button
    type="button"
    onClick={zoomIn}
    title="Zoom in (+)"
    aria-label="Zoom in"
    className="flex h-7 w-7 items-center justify-center rounded-full text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary"
  >
    <ZoomIn className="h-3.5 w-3.5" />
  </button>

  {/* divider */}
  <div className="mx-1 h-4 w-px bg-surface-border" />

  {/* history group */}
  <button
    type="button"
    onClick={undo}
    disabled={!canUndo}
    title="Undo (Ctrl+Z)"
    aria-label="Undo"
    className="flex h-7 w-7 items-center justify-center rounded-full text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-copy-secondary"
  >
    <Undo2 className="h-3.5 w-3.5" />
  </button>
  <button
    type="button"
    onClick={redo}
    disabled={!canRedo}
    title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
    aria-label="Redo"
    className="flex h-7 w-7 items-center justify-center rounded-full text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-copy-secondary"
  >
    <Redo2 className="h-3.5 w-3.5" />
  </button>
</div>
```

Notes:

- `nodrag nopan` opts the bar out of React Flow's drag/pan (v12 default `noDragClassName` / `noPanClassName`).
- `bottom-6 left-6` — sits at the bottom-left, well clear of the `ShapePanel` (bottom-center, `bottom-6 left-1/2`) and the top delete pill.
- Disabled buttons mirror the project's existing pattern (`disabled:opacity-40 disabled:cursor-not-allowed`).
- The divider is a single `1px` element, matching the spec's "thin divider."

### 3. `components/editor/canvas/canvas-room.tsx` (edit)

Three changes:

1. **Remove the `<MiniMap>` import** at line 10.
2. **Remove the `<MiniMap>` element** (lines 108-114). This is the spec's "remove the minimap at the bottom right."
3. **Add `<CanvasControlBar />`** as a sibling of `<ShapePanel />`, `<ShapeDragPreview />`, `<CanvasColorToolbar />` (currently lines 130-132), and add the import at the top with the other editor imports.

No other props on `<ReactFlow>` change.

### 4. `components/editor/index.ts` (edit)

Add:

```ts
export { CanvasControlBar } from "./canvas/canvas-control-bar";
```

in alphabetical position with the other canvas exports.

## Out of scope (per spec)

- The shape panel is not touched.
- Node / edge rendering is not touched.
- No additional canvas controls (e.g. lock, share) are added.
- The Liveblocks provider stack, presence, and `useLiveblocksFlow` wiring are not touched.

## Verification

1. `bun run build` passes (catches any type or import errors, especially around `useUndo`/`useRedo`/`useCanUndo`/`useCanRedo` from `@liveblocks/react` and the `ReactFlowInstance` import path from `@xyflow/react`).
2. Visual smoke (open the editor in a browser):
   - Bottom-left pill is visible with 3 zoom buttons + divider + 2 history buttons.
   - Click zoom-in: viewport zooms in smoothly (~200ms).
   - Click zoom-out: viewport zooms out smoothly.
   - Click fit-view: viewport snaps to fit the current node set smoothly.
   - After making an edit, undo button becomes enabled; clicking it reverts the edit; redo becomes enabled; clicking redo re-applies it.
   - With no edits, undo/redo are visibly dimmed and `disabled`.
3. Keyboard smoke (focus the canvas pane, not an input):
   - `+` and `=` zoom in; `-` zooms out.
   - `Ctrl+Z` / `Cmd+Z` undoes; `Ctrl+Shift+Z` / `Cmd+Shift+Z` redoes; `Ctrl+Y` / `Cmd+Y` redoes.
   - Focus a node label textarea and press `+`: nothing happens (no zoom, character is typed instead).
4. Confirm the minimap is gone from the bottom-right.
5. Confirm the shape panel and color toolbar still appear and behave as before.

## Open question (to flag in the plan only, no decision needed)

The spec doesn't say whether `useUndo`/`useRedo` should be called from the keyboard hook or only from the control bar buttons. The plan calls them from both: the control bar calls `useUndo`/`useRedo` for the buttons, and passes those exact same functions to `useKeyboardShortcuts` for the keyboard shortcuts — so the two paths can't drift apart.
