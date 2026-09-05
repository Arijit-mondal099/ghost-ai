# Plan: Base Canvas (Spec 11)

## Context

The editor workspace at `/editor/[roomId]` currently renders a `<p>Canvas</p>` placeholder in the `<main>` area. Spec 11 (`D:\code\build-with-claude-code\ghost-ai\.claude\context\specs\11-base-canvas.md`) replaces that placeholder with a Liveblocks-backed React Flow canvas — the foundation for all real-time collaborative editing in Ghost AI.

The Liveblocks provider stack is already in place from spec 10 (`/api/liveblocks-auth` route, `lib/liveblocks.ts` server client, `liveblocks.config.ts` Presence + UserMeta types). All required packages are installed: `@liveblocks/react@^3.24.1`, `@liveblocks/react-flow@^3.24.1`, `@xyflow/react@^12.11.6`. The only new runtime dep this spec needs is `react-error-boundary@^6.0.0` (user-approved, recommended by the Liveblocks skill).

The outcome: a dark, dot-pattern canvas surface in the `<main>` slot, with `<MiniMap>` in the bottom-right, ready to receive nodes/edges from a later spec. No custom node rendering, no controls, no persistence, no AI — just the collaborative foundation.

## Approach

Mirror the established **server-component / client-child** pattern (used in spec 08 for the editor shell and spec 09 for the share dialog). The server page (`app/editor/[roomId]/page.tsx`) stays untouched. A new client wrapper under `components/editor/canvas/` hosts the Liveblocks provider tree, and a one-line edit to `editor-workspace-client.tsx` swaps the placeholder for this wrapper.

## Files to Create

### 1. `types/canvas.ts` (new, project root)

Single source of truth for canvas-domain types. Path matches `liveblocks.config.ts` and `lib/`, importable as `@/types/canvas`. Project-root `types/` doesn't exist yet — this is its first file.

Exports:

- `NodeColor` — string-literal union of the 8 names from `ui-context.md` lines 56-67 (`"neutral"`, `"blue"`, `"purple"`, `"orange"`, `"red"`, `"pink"`, `"green"`, `"teal"`).
- `NodeShape` — string-literal union of the 6 shapes from `ui-context.md` lines 77-82 (`"rectangle"`, `"diamond"`, `"circle"`, `"pill"`, `"cylinder"`, `"hexagon"`).
- `NODE_COLORS` — `readonly` array of 8 `{ name: NodeColor; fill: string; text: string }` carrying the hex pairs from the ui-context table. Use `as const` so the union narrows from the data.
- `NODE_SHAPES` — `readonly` tuple `as const` of `NodeShape` values.
- `CanvasNodeData` — `{ label: string; color: NodeColor; shape: NodeShape }` (the spec's required fields only).
- `CanvasNode` — `Node<CanvasNodeData, typeof canvasNode>` from `@xyflow/react`.
- `CanvasEdge` — `Edge<Record<string, never>, typeof canvasEdge>` from `@xyflow/react`.
- `canvasNode`, `canvasEdge` — `as const` string-literal constants. Double as runtime type-name values and TS-level type names.
- `DEFAULT_NODE_COLOR: NodeColor` and `DEFAULT_NODE_SHAPE: NodeShape` (the "default node color" callout in `ui-context.md` line 67 is `#1F1F1F`, the `"neutral"` entry).

No `any`. No imports from `liveblocks.config.ts` (avoids circular import; canvas types are pure data shapes).

### 2. `components/editor/canvas/canvas-room.tsx` (new, `"use client"`)

The Liveblocks + React Flow client wrapper. Lives one level under `components/editor/canvas/` to leave room for future siblings (`canvas-node.tsx`, `canvas-controls.tsx`, etc.) without polluting the flat `components/editor/` directory.

Props: `{ roomId: string }` (a single string, not the whole project — narrow seam).

Top of file: `import "@xyflow/react/dist/style.css";` after the `"use client"` directive. Co-located CSS import is correct here: `@xyflow/react` declares `sideEffects: ["*.css"]` so the styles must be explicitly imported; the canvas is the only consumer so the styles should only ship when the canvas component ships (not in every route via `globals.css`).

Provider stack, in this order, with this exact nesting:

1. `<LiveblocksProvider authEndpoint="/api/liveblocks-auth">` — no `resolveUsers`/`resolveMentionSuggestions` (out of scope), no `throttle` override.
2. `<RoomProvider id={roomId} initialPresence={{ cursor: null, isThinking: false }}>` — `isThinking: false` is required because the existing `Liveblocks.Presence` type (in `liveblocks.config.ts` lines 13-18) declares `isThinking: boolean` as a required field. The spec's shorthand `cursor: null` is not enough to satisfy the type. Do not widen the Presence type — that's spec 10's contract.
3. `<ErrorBoundary FallbackComponent={CanvasErrorFallback}>` from `react-error-boundary` — fallback defined in the same file, renders a centered `text-copy-muted` "Connection lost — refresh to retry" message and logs the error to `console.error`.
4. `<ClientSideSuspense fallback={<span className="text-sm text-copy-muted">Connecting…</span>}>` from `@liveblocks/react/suspense` — simple text fallback per the spec ("simple loading state", no spinner/skeleton).
5. Inside the suspense boundary, the inner `Canvas` sibling component (defined in the same file). Splitting into two components inside one file keeps the `useLiveblocksFlow({ suspense: true })` rule happy: the hook must be called in a component that has a Suspense ancestor at the call site.

Inner `Canvas` component:

- `useLiveblocksFlow({ suspense: true })` — no `nodes.initial`, no `edges.initial` (spec: "start with empty nodes and edges"). No `storageKey` (default `"flow"` is correct). No `sync` config.
- Destructure `{ nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete }` from the hook.
- Wrap with `<ReactFlowProvider>` (required for `MiniMap` and any later `useReactFlow` consumers).
- Render `<ReactFlow>` with the prop set in section "React Flow Props" below.
- Export the outer wrapper as `CanvasRoom` (named export, matching the rest of `components/editor/*`).

## Files to Modify

### 3. `components/editor/index.ts` — add one re-export

Add `CanvasRoom` (and the `CanvasRoomProps` type alias) to the barrel's named exports. Re-export from `./canvas/canvas-room`. Insert alphabetically between `AccessDenied` and `CreateProjectDialog`.

### 4. `app/editor/[roomId]/editor-workspace-client.tsx` — surgical placeholder swap

Add `CanvasRoom` to the existing `@/components/editor` import group (one new identifier, no new import-line).

Replace the `<p>Canvas</p>` element inside the existing `<main>` block (lines 95-103) with `<CanvasRoom roomId={project.id} />`. The `<main>` element itself stays — same sidebar-shift classes (`pl-72`/`pl-0`, `pr-80`/`pr-0`). The `px-6` class is removed because the canvas should fill edge-to-edge; the sidebar/AI-sidebar paddings handle horizontal spacing.

Add `h-full w-full` to the `<main>` className list. `flex-1` claims the remaining vertical space inside the `flex h-dvh flex-col` root, but React Flow's `fitView` and `<MiniMap>` measure a definite height — `h-full` makes the height explicit. `w-full` is required so React Flow's container measurement doesn't collapse to 0.

No other changes. The `inert`/z-index pattern on the right AI sidebar, the share dialogs, and the navbar are independent — leave them alone.

### 5. `package.json` — add one runtime dep

Add `"react-error-boundary": "^6.0.0"` to `dependencies`. Then run `bun install` to regenerate `bun.lock`. No Suspense library needed — `ClientSideSuspense` comes from the already-installed `@liveblocks/react/suspense`.

### 6. `liveblocks.config.ts` — do NOT modify

`Storage: {}` is correct for this scope. `useLiveblocksFlow` accepts no `storageKey` override (default `"flow"`), and an empty Storage type lets Liveblocks lazily create the `flow` LiveObject with `nodes`/`edges` LiveMaps on first mount. The deeper typing of `nodes`/`edges` Live structures will be filled in by the spec that owns custom node/edge rendering — not this one. `RoomEvent`/`ThreadMetadata`/`RoomInfo` are owned by their respective future specs. Leaving them as `{}` keeps the type contract honest.

## React Flow Props (exact)

`<ReactFlow>` element in the inner `Canvas`:

- **From the hook**: `nodes`, `edges`, `onNodesChange`, `onEdgesChange`, `onConnect`, `onDelete`. `onDelete` is wired even though it has no observable effect with no nodes/edges — keeps the spec contract honest about wiring every handler the hook exposes.
- `connectionMode={ConnectionMode.Loose}` — the `ConnectionMode` enum from `@xyflow/react` (re-exported from `@xyflow/system`). React Flow v12 types `connectionMode` as the enum, not a raw string literal; passing `"loose"` directly fails `tsc`. The `Loose` value corresponds to "loose connection behavior" (drop on any node, no need to hit a handle). The default-handles-on-hover from `ui-context.md` lines 84-86 is a later node-renderer spec.
- `defaultEdgeOptions={{ type: "smoothstep", markerEnd: "arrowclosed" }}` — both values are valid `MarkerType` string literals in v12. The spec's "smooth-step path with an arrow marker" maps to this exact combination. Default edge stroke color is acceptable for the placeholder; a later spec will own the edge color override (the `ui-context.md` "default edge color: `#f8fafc`" is a target, not a current-state requirement).
- `fitView` (boolean, no options) — defaults `padding: 0.1` is correct.
- `className="h-full w-full"` — fills the `<main>` parent.
- `style={{ background: "var(--bg-base)" }}` — the spec-mandated dark canvas surface. The only raw token use in JSX, justified because the canvas surface IS the spec target.
- No `Controls` (spec: "no controls yet").
- No `nodeTypes`/`edgeTypes` (spec: "no custom node/edge rendering yet"). Defaults render `data.label` inside a rectangle, which is the spec's placeholder behavior.

Children of `<ReactFlow>` (in this order, both React Flow v12 child components, not props):

- `<Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--text-faint)" />` — `BackgroundVariant.Dots` enum from `@xyflow/react` (the `variant` prop is typed as the enum, not a raw string). `var(--text-faint)` is `#3a3a3a` per `ui-context.md` line 21, very low contrast so the dots recede. `gap={20} size={1}` are the React Flow dot defaults.
- `<MiniMap pannable zoomable maskColor="rgba(17, 17, 17, 0.8)" style={{ background: "var(--bg-surface)" }} nodeColor={() => "var(--text-secondary)"} />` — `rgba(17, 17, 17, 0.8)` is alpha-blended `--bg-base` so the unmapped area reads as the base color. The literal hex is acceptable because it's a one-time mask-color value passed to a non-tokenized third-party component, not a recurring `text-*`/`bg-*` class.

## Data Flow (roomId chain)

1. `app/editor/[roomId]/page.tsx` (server) — reads `roomId` from `await params`, validates access via `getAccessibleProject`, renders `<EditorWorkspaceClient project={{ id, name }} ... />`.
2. `app/editor/[roomId]/editor-workspace-client.tsx` (client) — receives `project.id` as a prop, passes `roomId={project.id}` to `<CanvasRoom>`.
3. `components/editor/canvas/canvas-room.tsx` — receives `roomId` as a prop, passes it to `<RoomProvider id={roomId}>`.
4. `RoomProvider` opens the WebSocket; the auth endpoint `/api/liveblocks-auth` POSTs the same roomId (sent automatically by the Liveblocks client), the route re-validates access, returns a session token.

No URL query string. No `useParams`. No `usePathname`. The roomId is in the dynamic segment and flows through three props in a straight line.

## Verification

Run from project root, in order. Each must pass before the next.

1. **`bun install`** — installs `react-error-boundary` and regenerates `bun.lock`.
2. **`bunx next typegen`** — generates `RouteContext` and route types into `.next/types/`. Required before typecheck.
3. **`bun run typecheck`** — `tsc --noEmit` must exit 0. Most likely failures: (a) forgetting `isThinking: false` in `initialPresence`, (b) passing raw strings for `connectionMode`/`variant` instead of the `ConnectionMode`/`BackgroundVariant` enums.
4. **`bun run lint`** — must exit 0; no `oxlint-ignore` comments.
5. **`bun run fmt`** then **`bun run fmt:check`** — formats new files, then verifies.
6. **`bun run build`** — production build must succeed; the new client component should appear as its own chunk.
7. **Manual smoke**: `bun run dev`, sign in, open a project. Verify the `<main>` area renders the dot-pattern background (not the previous "Canvas" placeholder) with `<MiniMap>` in the bottom-right corner. Open the same project in a second browser as a collaborator (via spec 09's share dialog) — both windows should render the same dot background and minimap with no WebSocket errors in the network tab. A 403 on `/api/liveblocks-auth` in the second window indicates a share-dialog permission regression outside spec 11's scope.

## Critical Files

- `D:\code\build-with-claude-code\ghost-ai\components\editor\canvas\canvas-room.tsx` (new)
- `D:\code\build-with-claude-code\ghost-ai\types\canvas.ts` (new)
- `D:\code\build-with-claude-code\ghost-ai\app\editor\[roomId]\editor-workspace-client.tsx` (modify: replace placeholder + add `h-full w-full` to `<main>` + drop `px-6`)
- `D:\code\build-with-claude-code\ghost-ai\components\editor\index.ts` (modify: add `CanvasRoom` re-export)
- `D:\code\build-with-claude-code\ghost-ai\package.json` (modify: add `react-error-boundary@^6.0.0`)

## Out of Scope (per spec)

- Controls (zoom/pan UI)
- Custom node/edge rendering — `nodeTypes`/`edgeTypes` not set
- Persistence to Postgres / Vercel Blob
- AI behavior (cursor presence is set up but no AI sidebar integration)
- Edge color override (placeholder uses default stroke; a later spec will own this)
