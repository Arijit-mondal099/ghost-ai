# Plan: 30 Spec Persistence + Download — ProjectSpec Model, Save Route, Download Route

## Context

Spec `.claude/context/specs/30-spec-persistence-download.md` is the persistence
unit that spec 29 explicitly deferred ("nothing is persisted here"). All backend
pieces it builds on exist: `TaskRun`/trigger flow (spec 29), the canvas Blob
pattern (`PUT/GET /api/projects/[projectId]/canvas` — private store, `put` +
Prisma URL write, `get()` by deterministic pathname, stored URL is
metadata-only), and the API conventions (`requireUserId`, `HttpError` helpers,
hand-rolled allow-list validators, owner-or-collaborator `findFirst` with
404+403 collapse).

**Current state:**

- No `ProjectSpec` model exists (`prisma/models/` has only `project.prisma` +
  `task-run.prisma`).
- No spec Blob upload, no `del`/`list` calls, no download route (verified by
  grep: `download|filePath|specs/*.md` hit only the spec doc).
- `trigger/generate-spec.ts` returns `{ ok: true, markdown }` with nothing
  persisted; `@vercel/blob@2.8.0` is already a dependency (spec 21).
- Blob path convention per `architecture-context.md`: specs live at
  `specs/{projectId}/{specId}.md`, URL stored in the DB row.

**Approved decisions (user, plan phase):**

- Persistence lives in a new POST save route called by the client after the
  realtime run completes, NOT inside the Trigger task (no new trigger secrets,
  reuses canvas-route patterns; client-submitted Markdown is acceptable —
  the saver owns the content).
- `ProjectSpec` stays minimal per spec text (no title field; list UI can add
  one later with its own migration).

## Files to Create

```
prisma/models/project-spec.prisma                              # ProjectSpec model
app/api/projects/[projectId]/specs/route.ts                   # POST save
app/api/projects/[projectId]/specs/[specId]/download/route.ts # GET download
```

## Files to Modify

1. `prisma/models/project.prisma` — add `specs ProjectSpec[]` back-relation.
2. `lib/api/validation.ts` — append `parseSpecSaveBody`.
3. `.claude/context/progress-tracker.md` — record implementation state.

No `trigger/`, canvas route, `proxy.ts`, `package.json`, or UI changes. New
migration via `bunx prisma migrate dev --name add_project_spec` (+ explicit
`bunx prisma generate` — migrate does not regenerate the client per session
notes), applied to Neon.

## Design

### Model (`prisma/models/project-spec.prisma`)

Metadata only; content lives in Vercel Blob:

```prisma
model ProjectSpec {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  filePath  String
  createdAt DateTime @default(now())

  @@index([projectId, createdAt])
}
```

`filePath` holds the Blob URL; the pathname is deterministic
`specs/{projectId}/{specId}.md`. Deleting a project cascades its spec rows
(same as collaborators + task runs).

### Validator (`lib/api/validation.ts`)

- `parseSpecSaveBody`: allow-list `["markdown"]`. `markdown` trimmed non-empty,
  ~500 KB UTF-8 byte guard (Groq caps output at 4000 tokens ≈ 16 KB, so this
  is generous headroom without inviting abuse). Same discriminated-union
  `{ ok: true; value } | { ok: false; code; message }` shape as the other
  parsers.

### POST `/api/projects/[projectId]/specs` (`app/api/projects/[projectId]/specs/route.ts`)

`requireUserId()` → 401 → trim `projectId` (`INVALID_ID` 400) → owner-or-
collaborator `findFirst` via verified Clerk emails → 404 (collapse, canvas
precedent) → parse JSON (`INVALID_JSON` 400) → `parseSpecSaveBody` (400) →
missing `BLOB_READ_WRITE_TOKEN` → 502 `BLOB_UNAVAILABLE`.

Write flow (Blob put cannot join the DB transaction, so ordered steps):

1. `prisma.projectSpec.create({ data: { projectId, filePath: "" } })` — mints
   the cuid `specId` first so the Blob pathname is deterministic.
2. `put(specs/{projectId}/{specId}.md, markdown, { access: "private",
contentType: "text/markdown; charset=utf-8", addRandomSuffix: false,
allowOverwrite: true })`.
3. Update the row with `blob.url`. Blob failure → delete the placeholder row
   (best-effort) + 502, so no orphan rows accumulate.

Returns `201 { id, createdAt }` + `Location:
.../specs/{specId}/download`. **No Blob URL in the body** — stricter reading
of "do not expose Blob URLs without access checks"; retrieval goes through
the gated download route.

### GET `.../specs/[specId]/download` (`.../[specId]/download/route.ts`)

Auth + project gate identical to the save route (401 → 400 → 404 collapse).
Then `prisma.projectSpec.findUnique({ where: { id: specId } })` + check
`spec.projectId === projectId` (and non-empty `filePath`) → 404
`SPEC_NOT_FOUND` on miss. This is the "spec belongs to that project" check.

Reads via SDK `get(pathname, { access: "private", useCache: false })` —
the stored URL is never fetched. Miss → 404. Streams the body to text and
returns it as `Content-Type: text/markdown; charset=utf-8` with
`Content-Disposition: attachment; filename="spec-{specId}.md"` (cuid is
filename-safe) + `Cache-Control: no-store`.

On status codes: 401 unauthenticated; 404 for inaccessible project _and_
foreign/missing spec (established collapse — avoids ID enumeration, so no
bare 403 is emitted; this is the "forbidden" handling per the spec-08/canvas
precedent); 502 on Blob outage.

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt:check` (new files) →
  `build` (expect 19 routes + Proxy). `migrate status` clean on Neon.
- Maps to Check-When-Done: model exists; save uploads to Blob + stores
  `filePath`; download validates access first; Markdown attachment response;
  TS + build pass.
- Live matrix (needs Clerk session + `BLOB_READ_WRITE_TOKEN`): save → row +
  blob object; owner + collaborator download 200 with `attachment` header;
  stranger → 404; unknown specId → 404; cross-project specId → 404; unauth → 401.

## Risks

- **Create-then-update gap:** a crash between row create and `filePath`
  update leaves a `filePath: ""` row; download treats empty as 404, and the
  blob-failure path deletes the row — bounded and self-consistent.
- **Client-submitted Markdown is trusted** (inherent to the POST-route
  choice); mitigated by auth + membership gate + size cap. The saver owns
  the content — acceptable per scope.
