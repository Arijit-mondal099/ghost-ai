# Plan: 31 Spec UI Integration — Sidebar List, Preview Modal, Download

## Context

Spec `.claude/context/specs/31-spec-ui-integration.md` wires spec-30
persistence into the editor: the AI sidebar Specs tab shows the current
project's specs, a modal previews rendered Markdown, and download actions
trigger file downloads.

**Current state:**

- `components/ai-sidebar/specs-tab.tsx` is a static shell: disabled
  Generate button + one hardcoded "E-commerce Backend Spec" demo card.
  `tabs.tsx:92-94` renders `<SpecsTab />` with no props (no `projectId`),
  though `AISidebarTabsProps` already carries `projectId`/`roomId` and
  `editor-workspace-client.tsx` already passes them.
- Backend has only `POST /api/projects/[projectId]/specs` (save) and
  `GET .../specs/[specId]/download` (attachment download) from spec 30.
  **No GET list endpoint and no dedicated preview/content endpoint exist**
  (verified by glob of `app/api/projects/**` + grep for `projectSpec`).
- `ProjectSpec` holds only `{ id, projectId, filePath, createdAt }` — no
  title. List rows show `spec-{id}.md` (matches the download
  `Content-Disposition` filename) + formatted `createdAt`.
- No Markdown library installed (`package.json` has no `react-markdown`).
  shadcn `Dialog`, `ScrollArea`, `Button` already exist (spec 01).

**Approved decisions (user, plan phase):**

- Preview content is fetched through the **existing download endpoint**
  (`fetch(url).text()`) — no Blob access from the client, no new
  content endpoint.
- The missing list fetch is a **prerequisite micro-task**: one minimal
  read-only `GET` list route, flagged as an explicit exception to the
  spec's "do not implement backend logic" limit. Everything else is
  frontend-only.
- Markdown rendering uses `react-markdown` (+ `remark-gfm`).

## Files to Create

```
hooks/use-project-specs.ts                      # list fetch hook
components/ai-sidebar/spec-preview-dialog.tsx   # preview modal
```

## Files to Modify

1. `app/api/projects/[projectId]/specs/route.ts` — append `GET` list handler.
2. `components/ai-sidebar/specs-tab.tsx` — real list wired to the hook.
3. `components/ai-sidebar/tabs.tsx` — pass `projectId` into `<SpecsTab />`.
4. `package.json` (+ `bun.lock`) — `bun add react-markdown remark-gfm`.
5. `.claude/context/progress-tracker.md` — record implementation state.

No `prisma/`, `trigger/`, canvas, save/download route, `proxy.ts`, or
`components/ui/*` changes. No migration. No new global state.

## Design

### GET `/api/projects/[projectId]/specs` (same file as the POST route)

Reuses the file's existing `resolveSpecAccess` / `accessResponse`
verbatim (401 → 400 `INVALID_ID` → 404 collapse, canvas precedent):

```ts
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/specs">,
): Promise<Response> {
  const access = await resolveSpecAccess(ctx);
  if (access.kind !== "ok") return accessResponse(access);
  const specs = await prisma.projectSpec.findMany({
    where: { projectId: access.projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  return json({
    specs: specs.map((s) => ({ id: s.id, createdAt: s.createdAt.toISOString() })),
  });
}
```

Never exposes `filePath`/Blob URLs. Empty array (not 404) for new
projects. `Cache-Control: no-store` is a client concern (`fetch` opt).

### Hook (`hooks/use-project-specs.ts`)

Mirrors `hooks/use-share-dialog.ts` (fetch-on-action + `readError` +
monotonic generation guard so a stale GET can't overwrite):

```ts
export type ProjectSpecMeta = { id: string; createdAt: string };
useProjectSpecs({ projectId }) → { specs, isLoading, errorMessage, refresh }
```

`fetch(`/api/projects/${projectId}/specs`, { cache: "no-store" })` on
mount / `projectId` change; `refresh` for retry. Hook-local state only.

### Specs tab (`components/ai-sidebar/specs-tab.tsx`)

Props `{ projectId: string }`. Keeps the existing Generate button as-is
(disabled, owned by the generation-flow spec — out of scope). Replaces
the demo card with:

- Loading / error + Retry / empty ("No specs yet") states.
- `ScrollArea` list of compact rows: `FileTextIcon` tile + truncated
  `spec-{id}.md` + mono `createdAt` line (instrument voice, existing
  pattern). Row click → select → opens preview dialog.
- Per-row download: `Button asChild` wrapping
  `<a href={downloadUrl} download>` — browser handles the file, no
  `fetch` + object-URL plumbing.
- Tokens only (`bg-surface`, `text-copy-primary/muted/faint`,
  `border-surface-border`); layout compact + scrollable per spec.

### Preview dialog (`components/ai-sidebar/spec-preview-dialog.tsx`)

Props `{ projectId, specId: string | null, onClose }`. shadcn `Dialog`
(open = `specId !== null`, `onOpenChange` → close) + `ScrollArea` body:

- On open: `fetch(downloadUrl, { cache: "no-store" })` → `.text()`.
  Loading / error states inside the dialog.
- Renders with `<ReactMarkdown remarkPlugins={[remarkGfm]}>` inside a
  `prose`-free, token-styled wrapper (no `@tailwindcss/typography` —
  style the markdown container with existing text tokens instead).
- Header download anchor (same `downloadUrl`, browser-handled) + close
  action. Close clears fetched Markdown from state immediately (no
  long-term content storage). Escape + focus trap come free from Radix.

### Wiring (`components/ai-sidebar/tabs.tsx`)

`<SpecsTab projectId={projectId} />` — one-line change; props already
threaded from `editor-workspace-client.tsx` through `AISidebar`.

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt` (touched files) →
  `build` (expect 20 routes + Proxy: one new GET on an existing path).
- Maps to Check-When-Done: list loads for the current project; modal
  shows rendered Markdown; download triggers file download; TS + build
  pass.
- Live matrix (needs Clerk session + `BLOB_READ_WRITE_TOKEN` + a saved
  spec): list shows the saved spec; click → modal renders Markdown;
  download (row + modal) saves `spec-{id}.md`; stranger/collaborator
  gates follow the save/download routes; empty project shows empty
  state; Escape closes the modal.

## Risks

- **Scope exception (accepted):** the GET list route is backend work
  against the spec's "do not implement backend" limit. Bounded: ~15
  lines, reuses the file's own gate, read-only, no Blob/DB writes.
- **`attachment` + `fetch().text()`:** the download route sets
  `Content-Disposition: attachment`, but `fetch` still exposes the body
  as text — preview works without a second endpoint. No behavior change
  to the route itself.
- **`react-markdown` v10+** requires React 19-safe usage (no
  `React.render`); project is React 19.2, fine. Rendered HTML is
  escaped by default; raw-HTML specs render as text (no `rehype-raw`) —
  acceptable, saver owns the content.
