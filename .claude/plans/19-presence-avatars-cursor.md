# Spec 19 — Liveblocks Presence Avatars + Live Cursors

## Context

The Ghost AI editor canvas is a Liveblocks-backed multi-user canvas. Today there is **no visual indicator of who else is in the room** — collaborators are invisible until they edit a node, and there is no way to see where another user is hovering. The Liveblocks presence plumbing (`Presence: { cursor, isThinking }` and `UserMeta: { id, info: { name, avatar, color } }`) is already wired in `liveblocks.config.ts` and stamped into session tokens by `/api/liveblocks-auth`, but **no consumer reads or broadcasts it yet**.

This spec adds two thin overlays inside the **editor canvas view only** (per the spec: not in the editor home view, not in the shared navbar):

1. A **collaborator avatar group** in the top-right of the canvas surface — filtered to exclude the current Clerk user, with the existing Clerk `<UserButton />` as the current-user representation, separated by a divider when collaborators exist.
2. **Live cursors** for other participants — a small colored pointer + name badge that follows each remote user's mouse over the canvas and clears when they leave.

The outcome: room participants are visible at a glance, and the spec's "show active room participants inside the editor canvas view" requirement is met without changing the editor home navbar or the canvas's existing chrome.

## Decision: do NOT rename `isThinking` → `thinking`

The existing field `isThinking: boolean` in `liveblocks.config.ts:25` already covers the spec's `thinking` requirement (nothing in this spec reads the field — only `cursor` is broadcast). Renaming would churn a type that `canvas-room.tsx:176`'s `initialPresence` and any future spec depend on. **No edit to `liveblocks.config.ts`.**

## Component split (3 new files + 1 hook + 2 edits)

| File                                                    | Purpose                                                                                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `components/editor/canvas/presence-avatars.tsx` _(new)_ | Top-right avatar group: filtered collaborator avatars (max 5 + `+N` chip), divider, Clerk `<UserButton />` (sized 32px to match avatars). |
| `components/editor/canvas/live-cursors.tsx` _(new)_     | One colored pointer + name badge per `other.presence.cursor` that is non-null.                                                            |
| `hooks/use-presence-cursor.ts` _(new)_                  | Returns `onMouseMove` / `onMouseLeave` handlers; broadcasts `cursor` in flow coordinates via `useUpdateMyPresence`.                       |
| `components/editor/canvas/canvas-room.tsx` _(edit)_     | Wire `usePresenceCursor` in `CanvasSurface`; mount the two new components; attach mouse handlers to the existing `relative` wrapper.      |
| `components/editor/index.ts` _(edit)_                   | Re-export the two new components.                                                                                                         |

**Files NOT touched** (spec forbids, or no need):

- `app/editor/editor-home-client.tsx`
- `components/editor/editor-navbar.tsx` (its own `<UserButton />` stays; canvas adds a second one as the spec requires)
- `liveblocks.config.ts`
- `lib/liveblocks.ts` (stays `server-only`; client reads `info.color` from Liveblocks)
- `app/api/liveblocks-auth/route.ts` (already stamps `color` into `userInfo`)
- `components/ui/*` (protected foundation — no shadcn `Avatar`)

## Detailed design

### `hooks/use-presence-cursor.ts`

```ts
// returns { onMouseMove, onMouseLeave }
```

- `useUpdateMyPresence()` from `@liveblocks/react` to get the setter.
- `useReactFlow<CanvasNode, CanvasEdge>().screenToFlowPosition({ x: event.clientX, y: event.clientY })` to convert client→flow coords (reuses the same helper as `useCanvasDrop`).
- Throttle to ~30 Hz (one update per ~33 ms via `useRef<number>` timestamp + `performance.now()`) to avoid flooding Liveblocks with one update per pixel of mousemove.
- `onMouseLeave` calls the setter with `{ cursor: null }` (preserves `isThinking` by reading the current value via `useSelf()`).
- `useCallback` for stable handler identity.
- Hook is unconditional (rules of hooks — must run on every render).

### `components/editor/canvas/presence-avatars.tsx`

- **Avatar primitive**: inline a copy of the `CollaboratorAvatar` + `initialsFor` pattern from `components/editor/share-project-dialog.tsx:56-84`, **with the same "no shadcn Avatar" comment** that the share dialog already documents. The share dialog deliberately did not extract these helpers into a shared module — keep parity.
- **Data**:
  - `const { user } = useUser()` from `@clerk/nextjs` — gives `currentUserId = user?.id ?? null`.
  - `const others = useOthers()` from `@liveblocks/react` — unfiltered list.
  - `const filtered = others.filter((o) => o.id !== currentUserId)` (Liveblocks `Other.id` matches Clerk user id, stamped by `identifyUser`).
  - If `user` is `null` (still resolving), render nothing — avoids flicker.
- **Layout (top-right, z-40, `nodrag nopan`)**:
  - Root: `<div className="nodrag nopan absolute top-4 right-4 z-40 flex items-center" />`. `nodrag nopan` matches `canvas-color-toolbar.tsx:108` and `canvas-control-bar.tsx:63` (opt out of React Flow drag/pan).
  - Up to 5 overlapping avatars (`-ml-2` on every avatar after the first), each `size=32`, with the same `flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-[10px] font-medium text-copy-secondary ring-1 ring-surface-border` base as the share dialog, plus `boxShadow: "0 0 0 2px var(--accent-primary-dim)"` on each (matches the ring precedent at `canvas-color-toolbar.tsx:151` and `canvas-node.tsx:75`).
  - `+N` overflow chip when `filtered.length > 5`: same dimensions and ring as an avatar, with `bg-elevated`, `text-[10px]`, `text-copy-secondary`, showing `+{filtered.length - 5}`.
  - **Divider** (`<div className="mx-1 h-4 w-px bg-surface-border" />` — reuses the exact divider from `canvas-control-bar.tsx:93`) only when `filtered.length > 0`.
  - **Clerk `<UserButton />`** after the divider. Sized to match the avatar diameter (32px) via an `appearance.elements.userButtonBox` override set to `"h-8 w-8"` — this is the Clerk element key for the UserButton's outer container (per `@clerk/react`'s typed `Elements` registry). The override is built once at module scope by spreading `authAppearance` so the navbar's appearance is unchanged:
    ```ts
    const canvasUserButtonAppearance = {
      ...authAppearance,
      elements: {
        ...authAppearance.elements,
        userButtonBox: "h-8 w-8",
      },
    } as const;
    ```
    The `as const` keeps it assignable to `ClerkAppearanceTheme` (which is augmented by `@clerk/react`).
  - If `filtered.length === 0`, render only the UserButton (no divider, no avatars).
  - `aria-hidden` on the inner avatar row (display-only per spec). The UserButton itself is interactive (opens account / sign-out menu).

### `components/editor/canvas/live-cursors.tsx`

- **Data**:
  - `const others = useOthers()` from `@liveblocks/react`.
  - `const visible = others.filter((other) => other.presence?.cursor !== null)`.
- **Coordinates**:
  - `useViewport()` from `@xyflow/react` → `{ x, y, zoom }`.
  - For each `other.presence.cursor` at flow position `(fx, fy)`, screen position is `(fx * zoom + viewport.x, fy * zoom + viewport.y)`. Presence is broadcast in flow coords (set by `use-presence-cursor`), so this round-trip survives pan/zoom.
- **Render**:
  - Root: `<div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden" />` — fills the relative wrapper, `pointer-events-none` (never blocks clicks/drags), `z-30` (below the `z-40` chrome, above the React Flow surface).
  - Per cursor: an absolutely positioned child at `{ left: screenX, top: screenY, transform: "translate(-2px, -2px)" }` (small offset so the pointer tip sits on the flow point). Inside:
    - A small inline SVG arrow (no new dep) filled with `other.info.color`, stroked with `var(--bg-base)` so the dark base doesn't bleed through.
    - A name badge offset to the right of the arrow tip, with `bg-[other.info.color]`, `text-copy-primary`, `text-[10px] font-medium`, `border border-surface-border`, `boxShadow: "0 0 0 2px var(--accent-primary-dim)"` for canvas contrast. Name fallback: `other.info.name || "Anonymous"`.
- **SSR safety**: `mounted` `useState` + `useEffect` gate, same as `canvas-color-toolbar.tsx:70-73` and `shape-drag-preview.tsx:120-125`. Return `null` pre-mount.

### Wiring into `CanvasSurface`

In `components/editor/canvas/canvas-room.tsx` (`CanvasSurface`):

1. Add `const presence = usePresenceCursor();` immediately after the existing `useCanvasDrop()` and before `useCanvasDelete` calls (rules of hooks — unconditional, before any conditional returns).
2. Spread `presence.onMouseMove` and `presence.onMouseLeave` onto the existing outer `<div className="relative h-full w-full">` (currently `onDragOver={drop.onDragOver} onDrop={drop.onDrop}`). Final props: `{ onDragOver, onDrop, onMouseMove, onMouseLeave }`. The wrapper is the established event surface — `useCanvasDrop` already attaches there, and attaching to this div (not `<ReactFlow>`) means the cursor also tracks over nodes/edges, which is the right semantic for presence. The spec's "update cursor position on React Flow's onMouseMove event" is satisfied because the wrapper IS the canvas surface.
3. Add `<LiveCursors />` and `<PresenceAvatars />` as siblings of the existing chrome. Final order in the wrapper: `<ReactFlow>`, the delete pill, `<LiveCursors />`, `<ShapePanel />`, `<ShapeDragPreview />`, `<CanvasColorToolbar />`, `<CanvasControlBar />`, `<PresenceAvatars />`, then the conditional `<CanvasTemplateFitOnLoad />`.

No other changes in `canvas-room.tsx`.

### Re-exports

`components/editor/index.ts` — insert the two new exports in alphabetical order with the other canvas entries:

```ts
export { LiveCursors } from "./canvas/live-cursors";
export { PresenceAvatars } from "./canvas/presence-avatars";
```

## Z-index / positioning summary

| Element                                                      | Position                                    | Why                                                                          |
| ------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------- |
| `<ReactFlow>`                                                | default                                     | existing                                                                     |
| `<LiveCursors />` root                                       | `absolute inset-0 z-30 pointer-events-none` | below chrome, above React Flow surface, never blocks input                   |
| Delete pill, color toolbar, control bar, **PresenceAvatars** | `z-40`                                      | existing in-canvas chrome family                                             |
| `EditorNavbar`                                               | `z-50`                                      | contains the existing Clerk `<UserButton />` (unchanged)                     |
| `PresenceAvatars`                                            | `absolute top-4 right-4`                    | top-right of the canvas `relative` wrapper, below the navbar's bottom border |

## Verification

1. `bun run typecheck` → exits 0.
2. `bun run lint` → exits 0.
3. `bun run build` → exits 0.
4. **Two-tab presence test**: open `/editor/{roomId}` in two browser windows as different Clerk users (owner + invited collaborator).
   - In tab A: tab B's avatar appears in the canvas top-right; tab A's `<UserButton />` appears next to it (canvas) AND in the navbar (unchanged). Divider visible only because collaborators exist.
   - In tab B: tab A's avatar appears; tab B's own UserButton is unchanged.
   - With 6+ users: only 5 avatars + `+N` chip.
5. **Live cursor test**: in tab A, move the mouse over the canvas. Tab B shows a small colored pointer following tab A's cursor with a name badge in the same color. Pan/zoom in tab B — the cursor floats with the node under it. Move the mouse off the canvas in tab A — the cursor disappears from tab B.
6. **Home view test**: open `/editor` — no presence group anywhere, navbar unchanged.
7. **Disconnect test**: kill and restart the dev server briefly. The avatar in the other tab briefly disappears and reappears on reconnect.

## Sequencing (as implemented)

1. Create `hooks/use-presence-cursor.ts`.
2. Create `components/editor/canvas/live-cursors.tsx`.
3. Create `components/editor/canvas/presence-avatars.tsx`.
4. Edit `components/editor/canvas/canvas-room.tsx` (wire hook, mount both components).
5. Edit `components/editor/index.ts` (re-exports).
6. Run `bun run typecheck && bun run lint && bun run build`.
7. Run the two-tab verification.

## Out of scope (explicit non-goals)

- No popover/menu on the avatar (display-only per spec).
- No `useOthersMapped` selector optimization (re-render cost is negligible vs. the existing `useLiveblocksFlow` re-renders).
- No persistence of cursor history / replay.
- No `isThinking` field consumption (declared; nothing reads it).
- No rename of `isThinking` → `thinking`.
- No changes to the editor home view, the shared navbar, the `liveblocks.config.ts`, `lib/liveblocks.ts`, or `components/ui/*`.
