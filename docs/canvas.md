# Collaborative Canvas

Realtime shared graph built on Liveblocks 3.x + React Flow (`@xyflow/react` 12).

## Wiring

- `liveblocks.config.ts` — global types: `Presence { cursor: {x,y} | null, isThinking }`, `Storage { aiStatus }` (graph itself lives in the `flow` LiveObject owned by `@liveblocks/react-flow`), `UserMeta { id, info: { name, avatar, color } }`, `RoomEvent AI_STATUS | AI_CHAT`.
- `components/editor/canvas/canvas-room.tsx` — `LiveblocksProvider(authEndpoint: /api/liveblocks-auth)` + `RoomProvider(roomId, initialPresence)` + `ErrorBoundary`/`ClientSideSuspense` sandwich. Inner surface (inside `ReactFlowProvider`) binds `useLiveblocksFlow({ suspense: true })` nodes/edges into `<ReactFlow ConnectionMode.Loose fitView MiniMap Background>`. A `{children}` dialog slot renders **inside** `RoomProvider` but **outside** `ErrorBoundary` so dialogs survive canvas errors.
- `app/editor/[roomId]/room-canvas.tsx` — composes `CanvasRoom` + AI sidebar + save/presence UI. `loading.tsx` shows the connecting skeleton.

## Schema (`types/canvas.ts`)

Single source of truth — templates and user content share it:

- `NODE_COLORS` — 8 fill/text pairs: neutral `#1F1F1F/#EDEDED` (default), blue, purple, orange, red, pink, green, teal.
- `NODE_SHAPES` — 6: `rectangle` (default), `diamond` (decision), `circle` (event), `pill` (service), `cylinder` (database), `hexagon` (external system).
- `CanvasNodeData { label, color, shape }`, `CanvasEdgeData { label }`, type keys `canvasNode` / `canvasEdge`.
- `lib/canvas/shape-definitions.ts` — default sizes (rect 160×80, diamond 160×120, circle 120×120, pill 180×80, cylinder 140×110, hexagon 180×110), drag MIME `application/x-ghost-shape`.

## Editing

| Action        | Implementation                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drag shape in | `shape-panel.tsx` (bottom floating pill, 6 draggable buttons) → `use-canvas-drop.ts` (`screenToFlowPosition`, center on cursor, `LiveObject.from(node)`)                                                                                   |
| Move / resize | React Flow `onNodesChange` → Storage sync; `NodeResizer` when selected (per-shape mins, `keepAspectRatio` for circle)                                                                                                                      |
| Connect       | 10px white handles (`#fff` + 2px `#111` ring), hidden until `group-hover`/selected; stable `top/left` target + `right/bottom` source IDs; `ConnectionMode.Loose`; default edge smooth-step + arrow marker `#f8fafc`                        |
| Node label    | Double-click or Enter on label button → inline `<input>` (`use-canvas-label-edit.ts`); Escape restores via `initialRef`; Enter/blur commits via `onNodesChange`                                                                            |
| Edge label    | Selected edge label becomes editable button, local `draft` while typing, single `setLabel` on commit (`use-canvas-edge-label-edit.ts`); unselected = non-interactive span                                                                  |
| Node color    | Floating toolbar above selection with 8 swatches (`canvas-color-toolbar.tsx` + `use-canvas-color-edit.ts`); origin-aware math `(position - origin * dimensions) * zoom + viewport`                                                         |
| Delete        | `use-canvas-delete.ts` via `onDelete` (node delete drops connected edges); Backspace/Delete skip inputs (`isContentEditable` + `closest("input, textarea")`); floating `Delete (N)` pill; thin edges clickable via `interactionWidth={20}` |
| Controls      | `canvas-control-bar.tsx` (zoom/fit/lock), `use-keyboard-shortcuts.ts` (delete/duplicate/escape)                                                                                                                                            |
| Drag preview  | Native ghost suppressed (transparent 1×1 `setDragImage`); custom `shape-drag-preview.tsx`                                                                                                                                                  |

## Presence

- `use-presence-cursor.ts` publishes `Presence.cursor`; `live-cursors.tsx` renders remote cursors with deterministic colors (`lib/cursor-color.ts`, djb2 → 8 slots); `presence-avatars.tsx` stacks navbar avatars.
- `ai-presence-overlay.tsx` renders the simulated Ghost cursor / thinking indicator from `AI_STATUS` events + persisted `aiStatus` storage (so late joiners see active runs).

## Persistence (autosave + restore + manual save)

- `use-canvas-autosave.ts` — debounced `PUT /api/projects/{id}/canvas` from the Liveblocks flow (owner or collaborator).
- `use-canvas-restore.ts` — `GET .../canvas` hydrates the flow on mount.
- `canvas-save-button.tsx` — manual save complement.
- Blob path `canvas/{projectId}.json` (private store); `canvasJsonPath` in Postgres holds the Blob URL reference only. API uses `put()`/`get()` server-side — clients never fetch Blob URLs directly.

## Starter templates

Static snapshots in the codebase (`components/editor/starter-templates.ts`), same node/edge schema as user content, no DB rows, resolved by template ID at import time.

Gallery: `starter-templates-modal.tsx` + `starter-template-card.tsx` → `use-canvas-template-load.ts` bulk-inserts into `flow` LiveMaps → `canvas-template-fit-on-load.tsx` runs `fitView`. Covers monolith, microservices, event-driven, serverless, and more. Import works at creation or any time during editing.
