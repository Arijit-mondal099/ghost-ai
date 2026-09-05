# Starter Templates (Spec 18)

## Context

New users drop into an empty canvas and have to drag shapes one-by-one to build anything meaningful. This change adds a small curated template library — three pre-built diagrams (microservices, CI/CD pipeline, event-driven system) — that a user can pick from a modal and have it **replace** the current canvas, fit the view, and stay collaborative through the existing Liveblocks storage. No server persistence, no template authoring UI, no changes to node/edge rendering.

User-confirmed decisions:

- **Entry point**: top navbar `rightActions` (Templates button with `LayoutTemplateIcon`), between Share and the AI sidebar toggle.
- **Mutation host**: the modal owns the load mutation; the workspace client only owns open/close state plus a numeric `templateFitVersion` for triggering a fit.
- **Templates**: exactly three.

## New files

| Path                                                       | Responsibility                                                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/editor/starter-templates.ts`                   | RSC-eligible data module. Exports `TemplateNode`, `TemplateEdge`, `CanvasTemplate` types; `CANVAS_TEMPLATES` (3 entries); `buildTemplate()` helper; dev-only `assertTemplateWellFormed()`.            |
| `components/editor/starter-templates-modal.tsx`            | `"use client"` modal. Wraps `EditorDialog.*`, calls `useCanvasTemplateLoad(roomId)`, runs the load → bumps `onImported()` → closes.                                                                   |
| `components/editor/starter-template-card.tsx`              | `"use client"` card. Renders name, description, inline-SVG preview, Import button.                                                                                                                    |
| `hooks/use-canvas-template-load.ts`                        | `"use client"` hook. One `useMutation` that clears `flow.nodes` + `flow.edges` `LiveMap`s and bulk-inserts each template node/edge via `LiveObject.from(...)`. Returns `{ loadTemplate, isLoading }`. |
| `components/editor/canvas/canvas-template-fit-on-load.tsx` | `"use client"` null-rendering component. Calls `useReactFlow()` + `useEffect` on a `version` prop to invoke `fitView()` on increment. Must be mounted inside `CanvasSurface` so the hook resolves.    |

## Edits to existing files

### `app/editor/[roomId]/editor-workspace-client.tsx`

- Add `useState<boolean>` for `isTemplatesOpen` and `useState<number>` for `templateFitVersion` (initial `0`).
- Import `LayoutTemplateIcon` from `lucide-react`; import `StarterTemplatesModal` from `@/components/editor`.
- In `rightActions`, between the existing Share button and the AI sidebar toggle, insert:
  ```tsx
  <Button variant="outline" size="sm" onClick={() => setIsTemplatesOpen(true)}>
    <LayoutTemplateIcon />
    Templates
  </Button>
  ```
- Pass `templateFitVersion` through to `<CanvasRoom ... templateFitVersion={templateFitVersion} />`.
- Mount `<StarterTemplatesModal open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen} roomId={project.id} onImported={() => setTemplateFitVersion((v) => v + 1)} />` alongside the existing dialogs.

### `components/editor/canvas/canvas-room.tsx`

- Extend `CanvasRoomProps` with `templateFitVersion?: number`.
- Inside `CanvasSurface` (descendant of `<ReactFlowProvider>`), when the prop is defined, render `<CanvasTemplateFitOnLoad version={templateFitVersion} />`. No other changes.

### `components/editor/index.ts`

- Add re-exports for `StarterTemplatesModal`, `StarterTemplateCard`, and `CANVAS_TEMPLATES`. The fit trigger stays internal to the canvas package.

## Data shape — `components/editor/starter-templates.ts`

```ts
import type { NodeColor, NodeShape } from "@/types/canvas";

export type TemplateNode = {
  key: string; // local id, e.g. "api-gateway"
  label: string;
  color: NodeColor;
  shape: NodeShape;
  x: number; // visual center
  y: number;
};
export type TemplateEdge = { source: string; target: string; label?: string };
export type CanvasTemplate = {
  id: string;
  name: string;
  description: string;
  nodes: ReadonlyArray<TemplateNode>;
  edges: ReadonlyArray<TemplateEdge>;
};
export const buildTemplate = (meta, body): CanvasTemplate => ({
  ...meta,
  nodes: body.nodes,
  edges: body.edges,
});
```

Per-shape dimensions come from the existing `SHAPES` array in `lib/canvas/shape-definitions.ts` — no duplication.

### Three templates (positions are visual centers)

- **microservices** (6 nodes / 5 edges): `client` (rect, blue) (80,40), `gateway` (hexagon, purple) (320,40), `auth`/`users`/`orders` (cylinder, neutral) at (160,220)/(320,220)/(480,220), `db` (cylinder, neutral) (320,380). Edges: client→gateway; gateway→auth,users,orders; orders→db.
- **ci-cd-pipeline** (6 nodes / 5 edges): `commit` (circle, blue) (80,40), `build` (rect, blue) (280,40), `test` (diamond, orange) (480,40), `stage` (rect, orange) (280,220), `prod` (rect, green) (480,220), `notify` (pill, neutral) (680,130). Edges: commit→build→test→stage→prod; prod→notify.
- **event-driven-system** (6 nodes / 7 edges): `producer` (rect, blue) (80,40), `topic` (hexagon, purple) (320,40), `consumer-a/b/c` (rect, green) at (160,220)/(320,220)/(480,220), `sink` (cylinder, neutral) (320,380). Edges: producer→topic; topic→a,b,c; a,b,c→sink.

## Mutation design — `hooks/use-canvas-template-load.ts`

Mirrors the pattern in `hooks/use-canvas-drop.ts` exactly. **No `roomId` argument** — `useMutation` resolves `storage` from the surrounding `<RoomProvider>` context (the modal is rendered inside the room). The same `CanvasFlowLive` + `LsonNodeRecord` types from `use-canvas-drop.ts:46-50` are re-declared locally (matches the convention used by `useCanvasColorEdit`, `useCanvasLabelEdit`, `useCanvasEdgeLabelEdit`).

```ts
const replace = useMutation(
  ({ storage }, payload: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
    const flow = storage.get("flow" as never) as unknown as LiveObject<CanvasFlowLive>;
    const liveNodes = flow.get("nodes");
    const liveEdges = flow.get("edges");
    for (const key of Array.from(liveNodes.keys())) liveNodes.delete(key);
    for (const key of Array.from(liveEdges.keys())) liveEdges.delete(key);
    for (const n of payload.nodes) {
      const live = LiveObject.from(n as unknown as Parameters<typeof LiveObject.from>[0]);
      liveNodes.set(n.id, live as unknown as LiveObject<LsonNodeRecord>);
    }
    for (const e of payload.edges) {
      const live = LiveObject.from(e as unknown as Parameters<typeof LiveObject.from>[0]);
      liveEdges.set(e.id, live as unknown as LiveObject<LsonNodeRecord>);
    }
  },
  [],
);
```

`loadTemplate(template)`:

1. Generate one `nonce` for the whole import: `crypto.randomUUID?.() ?? \`${Date.now()}-${Math.random().toString(36).slice(2,10)}\``.
2. Expand each `TemplateNode` into a `CanvasNode`:
   - `id: \`${template.id}--${n.key}--${nonce}\``
   - `type: "canvasNode"` (from `types/canvas.ts` `canvasNode` const)
   - `position: { x: n.x, y: n.y }`
   - `data: { label: n.label, color: n.color, shape: n.shape }`
   - `width` / `height`: from `SHAPES.find(s => s.id === n.shape)!.dimensions`
   - `measured: { width, height }` (same)
   - `origin: [0.5, 0.5]` (matches `useCanvasDrop`)
3. Expand each `TemplateEdge` into a `CanvasEdge`:
   - `id: \`${template.id}--${src}-${tgt}--${nonce}\``
   - `source: \`${template.id}--${src}--${nonce}\``, `target` likewise
   - `data: { label: e.label ?? "" }`
   - `type: "canvasEdge"`
   - `markerEnd: { type: MarkerType.ArrowClosed, color: "var(--text-secondary)" }` (matches `defaultEdgeOptions` in `canvas-room.tsx:97-100`)
4. `replace({ nodes, edges })`, then `await Promise.resolve()` (one microtask) so React Flow has a chance to read the new storage, then resolve.

`isLoading` is the `useMutation` status flag exposed via `useMutation`'s status callback — wire it from the second-tuple return. If unavailable, use a local `useState<boolean>` toggled around the call.

ID strategy rationale: per-import nonce makes re-importing the same template idempotent in shape but never colliding with the previous import's IDs, so React Flow never sees duplicate keys.

## Modal — `components/editor/starter-templates-modal.tsx`

Props: `{ open: boolean; onOpenChange: (open: boolean) => void; roomId: string; onImported: () => void }`.

Structure (mirrors `share-project-dialog.tsx`):

- `<EditorDialog.Root open={open} onOpenChange={onOpenChange}>`
- `<EditorDialog.Content className="sm:max-w-2xl">` (override the default `sm:max-w-sm`)
- Header: Title "Start from a template" + Description "Pick a starting diagram. This replaces the current canvas."
- Body: `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">` mapping `CANVAS_TEMPLATES` to `<StarterTemplateCard ... />`.
- Footer: `<EditorDialog.Close asChild><Button variant="ghost">Cancel</Button></EditorDialog.Close>`.
- Empty-state fallback when `CANVAS_TEMPLATES.length === 0`.

`onImport(template)` flow:

1. `await loadTemplate(template)`.
2. `onImported()` → bumps `templateFitVersion` in the workspace client.
3. `onOpenChange(false)` → closes the modal.

## Card — `components/editor/starter-template-card.tsx`

Props: `{ template: CanvasTemplate; onImport: (t: CanvasTemplate) => void; disabled: boolean }`.

Structure (top → bottom):

- `<div className="rounded-2xl border border-surface-border bg-surface p-4 flex flex-col gap-3">`
- Header row: `<h3 className="text-sm font-medium text-copy-primary">{template.name}</h3>` + small `<span className="text-xs text-copy-muted">{template.nodes.length} nodes</span>`.
- Description: `<p className="text-xs text-copy-secondary line-clamp-2">{template.description}</p>`.
- Preview viewport: `<div className="rounded-xl bg-base border border-surface-border h-40 w-full overflow-hidden">` wrapping the inline-SVG preview.
- Import button: full-width `<Button variant="default" size="sm" disabled={disabled} onClick={() => onImport(template)}>Import</Button>`.

## Inline-SVG preview (inside the card)

One `<svg>` per card. Mirrors the convention in `components/editor/canvas/shape-drag-preview.tsx` (CSS radii + inline SVG path strings — the file's own comment says "two consumers is below the bar for extraction"; three is still below the bar).

- `viewBox`: `\`${minX - 16} ${minY - 16} ${(maxX - minX) + 32} ${(maxY - minY) + 32}\``where bounds are computed from each node's center ±`SHAPES` width/height / 2. 16-px padding.
- `preserveAspectRatio="xMidYMid meet"`, `className="w-full h-full"`. No manual scaling math.
- Single `<defs>` with one `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">` containing `<path d="M0,0 L10,5 L0,10 z" fill="var(--text-secondary)" />`.
- Draw edges first (so nodes paint over them): one `<line>` per edge with `markerEnd="url(#arrow)"`, `stroke="var(--text-secondary)"`, `strokeWidth={1.25}`.
- Draw nodes second: a small switch on `shape`:
  - `rectangle` → `<rect x={x - w/2} y={y - h/2} width={w} height={h} rx={8} fill={fill} stroke="var(--surface-border)" />`
  - `pill` → same `rect` with `rx={h/2}`
  - `circle` → `<ellipse cx={x} cy={y} rx={w/2} ry={h/2} fill={fill} stroke="var(--surface-border)" />`
  - `diamond` → `<polygon points={\`${x},${y - h/2} ${x + w/2},${y} ${x},${y + h/2} ${x - w/2},${y}\`} ...>`
  - `hexagon` → `<polygon points={hexagonPoints(w, h, x, y)} ...>` where `hexagonPoints` produces 6 vertices with the inner notches at `width * 0.25` (mirroring `canvas-node.tsx:189-258`)
  - `cylinder` → `<path d={cylinderPath(w, h, x, y)} ...>` with the elliptical top + straight sides + elliptical bottom (same path string used in `shape-drag-preview.tsx`)
- `fill` from `NODE_COLORS.find(c => c.name === node.color)!.fill`.
- **No labels** in the preview — too small to read at this scale; the card's name/description carry that information.

## Fit trigger — `components/editor/canvas/canvas-template-fit-on-load.tsx`

```tsx
"use client";
import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";

export function CanvasTemplateFitOnLoad({ version }: { version: number }) {
  const rf = useReactFlow();
  const last = useRef(version);
  useEffect(() => {
    if (last.current === version) return;
    last.current = version;
    const id = window.requestAnimationFrame(() => rf.fitView({ duration: 300, padding: 0.2 }));
    return () => window.cancelAnimationFrame(id);
  }, [version, rf]);
  return null;
}
```

Why a separate component: `useReactFlow()` must resolve inside `<ReactFlowProvider>`. The modal lives outside the canvas surface, so it cannot call the hook directly. Mounting this null-rendering component inside `CanvasSurface` is the minimal change that satisfies the constraint while keeping the modal pure.

Wiring chain: workspace client holds `templateFitVersion` → passes it to `<CanvasRoom templateFitVersion={...} />` → `CanvasRoom` renders `<CanvasTemplateFitOnLoad version={...} />` inside `CanvasSurface` → modal calls `onImported()` after a successful load → workspace client bumps the version → effect runs → `fitView()` fires.

## Critical files to modify

- `D:\code\build-with-claude-code\ghost-ai\app\editor\[roomId]\editor-workspace-client.tsx` (state + button + modal mount)
- `D:\code\build-with-claude-code\ghost-ai\components\editor\canvas\canvas-room.tsx` (accept + render fit trigger)
- `D:\code\build-with-claude-code\ghost-ai\components\editor\index.ts` (re-exports)

## Reused functions / utilities (do not duplicate)

- `useMutation` from `@liveblocks/react/suspense` (per-hook contract — see `hooks/use-canvas-drop.ts:65-75`).
- `LiveObject.from(...)` boundary cast (same as `hooks/use-canvas-drop.ts:73`).
- `CanvasFlowLive` + `LsonNodeRecord` type pattern (re-declared in each hook, by convention).
- `SHAPES` from `lib/canvas/shape-definitions.ts` for per-shape dimensions.
- `NODE_COLORS` + `NodeColor` + `NodeShape` + `canvasNode` + `canvasEdge` from `types/canvas.ts`.
- `EditorDialog` from `components/editor/dialog.tsx` (do NOT use the raw `Dialog` from `components/ui/`).
- `Button` from `components/ui/button.tsx`.
- `cn` from `lib/utils`.
- Shape SVG path strings copied from `components/editor/canvas/shape-drag-preview.tsx` and `components/editor/canvas/canvas-node.tsx` (per the explicit "below the bar for extraction" comment).

## Verification

- **Build**: `bun run build` passes (no TS or ESLint errors). Strict mode catches any `any` introduced.
- **Smoke (single tab)**:
  1. Open `/editor/[roomId]`.
  2. Click `Templates` → modal opens with three cards; each card shows a recognizable miniature.
  3. Drag a couple of shapes onto the canvas, then re-open and Import "microservices".
  4. Canvas now shows the microservices diagram, fitted to the viewport; old nodes are gone.
  5. Import a different template — no stale nodes remain, no console errors, no React Flow duplicate-key warnings.
- **Collaboration (two tabs)**: open the same room in two tabs. Drop a node in tab A, then import a template in tab B → tab A sees a clean replacement (no half-cleared state). Reverse the direction — same result.
- **Edge cases**: importing the same template twice produces fresh node/edge IDs (the `nonce`); React Flow's reconciliation does not flash duplicate-key warnings.

## Out of scope (per spec)

- No template saving, no "Save current canvas as template" UI.
- No custom user-defined templates, no template authoring tools.
- No server persistence — `CANVAS_TEMPLATES` is a hardcoded array.
- No changes to node/edge rendering behavior in `canvas-node.tsx` or `canvas-edge.tsx`. Only the canvas-room fit trigger and the rightActions slot are touched.
- No new dependencies (`LayoutTemplateIcon` from `lucide-react` is the only new icon).
