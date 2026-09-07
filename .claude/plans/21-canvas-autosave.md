# Plan: 21 Canvas Autosave — Persist Canvas JSON to Vercel Blob

## Context

Spec `.claude/context/specs/21-canvas-autosave.md` adds autosave + loading for the
collaborative canvas. Prisma stores metadata + the canvas blob URL
(`canvasJsonPath`, already on the model); Vercel Blob stores the actual canvas JSON.

**Current state:**

- `prisma/models/project.prisma:18` already declares `canvasJsonPath String?` —
  no migration needed.
- `@vercel/blob` is **not** installed (`package.json` has no blob dep).
- Canvas graph is owned by `useLiveblocksFlow`'s `flow` LiveObject
  (`components/editor/canvas/canvas-room.tsx:97-100`). All write hooks use the
  `useMutation` + `LiveObject.from` + LSON-cast pattern
  (`hooks/use-canvas-template-load.ts:107-129`).
- No Save button exists. Navbar `rightActions` hosts Share/Templates/AI
  (`app/editor/[roomId]/editor-workspace-client.tsx:73-100`); canvas shell hosts
  the control bar.
- Dynamic routes use Next 16 `RouteContext<'/...'>` + `await ctx.params`
  (`app/api/projects/[projectId]/route.ts:40,50`); run `bunx next typegen`
  before `tsc`.

**Approved decisions:**

- Write access: owner **+ collaborators** (anyone who can edit the realtime
  canvas can autosave; mirrors the collaborators `GET` read gate, not the
  owner-only mutation gate).
- Status UI: **new navbar button** (manual Save + status text) in
  `EditorNavbar rightActions`.
- Blob strategy: **overwrite fixed path** `canvas/{projectId}.json`
  (`addRandomSuffix: false`, `allowOverwrite: true`); matches
  `architecture-context.md` storage model.

## Files to Create

```
app/api/projects/[projectId]/canvas/route.ts  # PUT (save) + GET (load)
hooks/use-canvas-autosave.ts                   # debounced autosave + status
hooks/use-canvas-restore.ts                    # one-shot load-on-empty
components/editor/canvas/canvas-save-button.tsx  # navbar Save + status button
```

## Files to Modify

1. `package.json` + `bun.lock` — `bun add @vercel/blob`.
2. `lib/api/validation.ts` — append `parseCanvasSaveBody`.
3. `components/editor/canvas/canvas-room.tsx` — accept `saveStatus`,
   `onSaveStatusChange`, `saveRequestVersion`; mount both hooks inside
   `CanvasSurface`.
4. `app/editor/[roomId]/editor-workspace-client.tsx` — own `saveStatus` +
   `saveRequestVersion` state; render `<CanvasSaveButton>` in navbar
   `rightActions`; pass props into `<CanvasRoom>`.
5. `components/editor/index.ts` — barrel-export the button.

No `prisma/` change. No `proxy.ts`, `globals.css`, or `components/ui/*` change.

## Design

### Validation (`lib/api/validation.ts`)

Add `parseCanvasSaveBody(input): ParseResult<{ nodes: unknown[]; edges: unknown[] }>`:

- Plain object, allow-list `["nodes", "edges"]` (same `rejectUnknownFields`
  helper as the other parsers).
- `nodes` / `edges` must both be arrays; each entry a plain object with a
  string `id` (opaque otherwise — node/edge schema stays owned by
  `types/canvas.ts`, not re-validated here).
- Size guard on `JSON.stringify(body).length` (~5 MB) →
  `400 CANVAS_TOO_LARGE`.

### API routes (`app/api/projects/[projectId]/canvas/route.ts`)

Shared `resolveCanvasAccess(ctx)` mirroring the collaborators `GET` read gate
(`app/api/projects/[projectId]/collaborators/route.ts:37-73`):

- `requireUserId()` → 401 on miss.
- `currentUser()` all-addresses (lowercased) +
  `prisma.project.findFirst({ where: { id, OR: [owner, collaborator-by-email] } })`.
- Null → 404 (collapse missing + unauthorized, same as `getAccessibleProject`).
- Both verbs use this one gate.

`PUT`:

- Parse JSON → `parseCanvasSaveBody` → 400 on failure.
- Missing `BLOB_READ_WRITE_TOKEN` → `502 BLOB_UNAVAILABLE` (same shape as the
  Liveblocks route's `502 LIVEBLOCKS_UNAVAILABLE`).
- `put("canvas/{projectId}.json", JSON.stringify({ nodes, edges, savedAt }),
{ access: "public", contentType: "application/json",
addRandomSuffix: false, allowOverwrite: true })`.
- `prisma.project.update({ where: { id }, data: { canvasJsonPath: blob.url } })`.
- Return `200 { url, savedAt }`. Blob throw → `502 BLOB_UNAVAILABLE`.

`GET`:

- `prisma.project.findUnique({ select: { canvasJsonPath } })`; null/empty →
  `404 CANVAS_NOT_FOUND` (client treats as fresh canvas, not an error).
- `fetch(canvasJsonPath)` server-side, `Cache-Control: no-store` on the
  response; non-OK → `502 BLOB_UNAVAILABLE`.
- Return parsed `{ nodes, edges, savedAt }` bare (no `{ data }` wrapper, per
  `lib/api/responses.ts` convention).

### Autosave hook (`hooks/use-canvas-autosave.ts`)

`"use client"`, mounted inside `CanvasSurface` (only place `nodes`/`edges`
exist):

```ts
type SaveStatus = "idle" | "saving" | "saved" | "error";
useCanvasAutosave({ projectId, nodes, edges, saveRequestVersion, onStatusChange });
```

- Debounce ~1500 ms after the last `nodes`/`edges` change; skip the first-mount
  render (avoids saving a pristine empty room over a good blob).
- Skip PUT while `nodes` + `edges` are both empty unless a restore just
  populated (guard flag) — prevents wiping saved state while storage is still
  connecting.
- `saveRequestVersion` bump (navbar manual button) flushes immediately,
  bypassing debounce.
- `fetch("PUT /api/projects/{id}/canvas", ...)`; OK → `saved`, throw/non-2xx →
  `error`. Report via `onStatusChange` so the navbar (outside `RoomProvider`)
  can render it. Expose `{ status, saveNow }`.

### Restore hook (`hooks/use-canvas-restore.ts`)

`"use client"`, inside `CanvasSurface`, runs once after suspense resolves:

- If `nodes.length > 0 || edges.length > 0` → skip entirely (active
  collaboration guard, spec §4).
- Else `GET /api/projects/{id}/canvas`; `404 CANVAS_NOT_FOUND` → no-op.
- On payload: same atomic replace mutation as
  `use-canvas-template-load.ts:107-129` (clear both LiveMaps, bulk
  `LiveObject.from` insert), then `fitView` via `useReactFlow` (same pattern as
  `CanvasTemplateFitOnLoad`).
- Set a `restoredRef` the autosave hook reads so the post-restore render is not
  mistaken for user edits.

### UI wiring

`components/editor/canvas/canvas-save-button.tsx`:

- `Button variant="outline" size="sm"` with status-driven icon/label:
  `Loader2Icon` "Saving…", `CheckIcon` "Saved", `AlertTriangleIcon` "Retry",
  else `SaveIcon` "Save". Token-only colors (`text-copy-muted`,
  `text-destructive`). Manual click → `onSave()`.

`editor-workspace-client.tsx`:

- Own `saveStatus` + `saveRequestVersion` state; pass into `<CanvasRoom>`;
  render `<CanvasSaveButton status onSave={bump}>` in navbar `rightActions`
  ahead of Share.

## Verification

- `bunx next typegen` → `bun run typecheck` → `bun run lint` →
  `bun run fmt:check` (new files) → `bun run build` clean.
- Live matrix (needs Clerk session + `BLOB_READ_WRITE_TOKEN`): edit →
  `saving` → `saved`; reload empty room restores + fits; reload with active
  peers skips; collaborator PUT succeeds; signed-out PUT/GET → 401; unknown
  project → 404; `canvasJsonPath` null → GET `404 CANVAS_NOT_FOUND`; missing
  token → `502` + error state, manual Retry recovers.

## Risks

- **Status lives outside the room**: the navbar cannot call `useMutation`, so
  the callback-prop + version-counter bridge is the minimal seam. (Alternative
  rejected: status pill inside `CanvasControlBar`.)
- **Two-tab overwrite race**: last-writer-wins on the fixed path; acceptable —
  Liveblocks remains source of truth during a session.
- **Template import interplay**: template load replaces the graph; autosave
  will then persist the template — intended.
