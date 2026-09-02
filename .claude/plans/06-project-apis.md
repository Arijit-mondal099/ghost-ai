# Plan: Project CRUD API Routes (Spec 06)

## Context

Spec `.claude/context/specs/06-project-apis.md` calls for the first batch of backend route handlers in the ghost-ai project — currently there is no `app/api/` directory at all. The Prisma schema (`prisma/models/project.prisma`) and first migration are already in place, and Clerk is wired in via `proxy.ts`. This unit builds the four project endpoints the editor UI will eventually call, but the spec is explicit that the UI wiring (e.g. `hooks/use-project-dialogs.ts` swap from mock data) is a separate later unit. Done means: routes exist, owner checks enforced, 401/403 correct, and `bun run build` passes.

Two findings from exploration shaped this plan:

- **Schema has `@default(cuid())` already** (`prisma/models/project.prisma:13`). The migration SQL omits a SQL `DEFAULT` because Prisma generates the cuid at the client layer before INSERT. Spec line 19 ("use the schema's existing ID strategy, do not add sequential IDs") is satisfied by passing `data: { ownerId, name }` and letting Prisma fill in the id. No new migration, no new dep.
- **No API route patterns exist in this codebase yet** — `app/api/` is greenfield. The plan establishes a small, reusable trio under `lib/api/` so each route handler stays thin and the 401/403 contract is auditable in one place.

## Files to create

### Shared API utilities (one feature unit)

- `lib/api/auth.ts` — `requireUserId(): Promise<string>`. Calls `auth()` from `@clerk/nextjs/server`; throws `HttpError(401, "UNAUTHENTICATED", "Authentication required")` if `userId` is null. Defense in depth: `proxy.ts` already calls `auth.protect()` for `/api/.*` via its matcher, but the route still needs the typed id and a clean 401 contract.
- `lib/api/responses.ts` — exports `HttpError` class, `json<T>(data, init?)`, `error(status, code, message)`, and four status shortcuts (`unauthorized`, `forbidden`, `notFound`, `badRequest`). All errors return `{ error: { code, message } }` with `Content-Type: application/json`. Success payloads are returned bare (no `{ data }` wrapper) to keep the contract simple.
- `lib/api/validation.ts` — Zod-free hand-rolled parsers: `parseCreateProjectBody(input: unknown)` and `parseRenameProjectBody(input: unknown)`, each returning a discriminated union `{ ok: true, value } | { ok: false, code, message }`. No new dep — four routes don't justify pulling in Zod.

### Route handlers (two feature units)

- `app/api/projects/route.ts` — `GET` (list) and `POST` (create).
- `app/api/projects/[projectId]/route.ts` — `PATCH` (rename) and `DELETE` (delete).

## Per-route design

### `GET /api/projects` — list current user's projects

- Auth: `requireUserId()` → 401 if absent.
- No body, no params.
- Prisma: `prisma.project.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" }, select: { id, name, description, status, canvasJsonPath, createdAt, updatedAt } })`.
- Response: `200 { projects: Project[] }`. Empty list (`[]`) for new users, **not 404** — the collection exists; the user just owns nothing yet.
- Errors: 401 only.

### `POST /api/projects` — create project

- Auth: `requireUserId()` → 401.
- Body: `{}` or `{ name?: string }`. Reject any other field via allow-list parsing.
- Validation: `name` optional; if present, trim, then require 1–120 chars after trim. Default to `"Untitled Project"` when absent or empty.
- Prisma: `prisma.project.create({ data: { ownerId: userId, name }, select: <same select as list> })`. **Do not pass `id`** — Prisma's `@default(cuid())` applies at the client layer.
- Response: `201` with the created project, plus `Location: /api/projects/{id}` header.
- Errors: 400 (bad body), 401.

### `PATCH /api/projects/[projectId]` — rename project

- Auth: `requireUserId()` → 401.
- Params: `await ctx.params` (Next 16: `context.params` is a `Promise` — see Risk #1). Extract `projectId`; treat empty/blank as 400.
- Body: `{ name: string }` required, trimmed, 1–120 chars. Allow-list rejects extra fields.
- Two-step Prisma pattern (preserves the 403-vs-404 distinction the spec requires):
  1. `prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } })` → if `null`, return 404.
  2. If `ownerId !== userId`, return 403.
  3. `prisma.project.update({ where: { id: projectId }, data: { name }, select: <full select> })`.
- Response: `200` with the updated project.
- Errors: 400, 401, 403, 404.

The two-step is intentional. A single `update({ where: { id, ownerId } })` would conflate "not found" with "not owner" — both return `null`, so the route would have to pick 403 or 404 arbitrarily.

### `DELETE /api/projects/[projectId]` — delete project

- Auth + params + two-step pattern identical to PATCH.
- `prisma.project.delete({ where: { id: projectId } })`. The `ProjectCollaborator.project` relation has `onDelete: Cascade` (`prisma/models/project.prisma:34`) so collaborators are removed automatically.
- Response: `204 No Content`, empty body.
- Errors: 400, 401, 403, 404.

## ID generation

**Do nothing.** The schema already declares `id String @id @default(cuid())` (`prisma/models/project.prisma:13`). Pass `data: { ownerId, name }` to `prisma.project.create()` and let Prisma emit the cuid at the client layer. The migration's `CREATE TABLE` does not include a SQL `DEFAULT` because the default is applied before INSERT, not by the database.

If verification shows the generated client rejects an insert without `id` (it should not), the fallback is `crypto.randomUUID()` — but do not reach for `cuid2` or add a new dep.

## Verification

### Automated gates (all must pass)

1. `bun run fmt:check` — oxfmt is strict (double quotes, no semicolons).
2. `bun run lint` — oxlint.
3. `bun run typecheck` — Next 16 generates route types via `next typegen`; if `tsc` complains about missing globals, run `bun run build` once to materialize them, then re-run typecheck.
4. `bun run build` — the spec's "done" gate.

### Manual smoke matrix (with Clerk-signed cookie, dev server)

For each route, exercise four paths: **unauthenticated → 401, wrong owner → 403, owner happy path → 2xx, missing id → 404**.

- `GET /api/projects` — no cookie → 401. Logged in, no projects → `200 { projects: [] }`. After create → listed newest-first → 200.
- `POST /api/projects` — no cookie → 401. `{}` → 201 with `name: "Untitled Project"`. `{ "name": "   " }` → 400. `{ "name": "Real" }` → 201. `{ "id": "x" }` → 400 (allow-list violation).
- `PATCH /api/projects/{ownedId}` — no cookie → 401. Other user's id → 404 (you can't see it) or 403 (you can see it but can't mutate). Owned id, `{ "name": "New" }` → 200 with renamed field. Empty name → 400. Bogus cuid → 404.
- `DELETE /api/projects/{ownedId}` — same 401/403/404 matrix. Happy path → 204, subsequent GET no longer lists it.

### Database sanity

- After DELETE, `SELECT * FROM "ProjectCollaborator" WHERE "projectId" = ...` is empty (verifies cascade).
- After CREATE, `SELECT id FROM "Project" WHERE "ownerId" = '<clerk_user_id>'` returns a `c...` cuid (verifies `@default(cuid())` end-to-end).

## Out of scope (do not touch)

- `lib/projects.ts` — mock data + `slugify`. UI still reads mocks.
- `hooks/use-project-dialogs.ts` — spec says "do not wire the UI yet."
- `prisma/schema.prisma`, `prisma/models/*.prisma`, no new migration.
- `proxy.ts` — Clerk already covers `/api/.*`.
- `lib/prisma.ts` — singleton is correct and the generated-client import path is already pinned.
- No Trigger.dev jobs, no `Idempotency-Key` header, no slug-based lookup routes.

## Risks and callouts

1. **Next 16 dynamic params are a `Promise`.** The handler signature is `(req, ctx: { params: Promise<{ projectId: string }> })` and the body must `await ctx.params`. Forgetting the `await` is the single most likely bug. A `RouteContext<'/api/projects/[projectId]'>` global helper is also generated by Next 16; use it for stronger types. Confirm against `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before coding — `AGENTS.md` warns that Next 16 conventions differ from older training data.
2. **First Explore agent misread the schema** as having no default. The actual file at `prisma/models/project.prisma:13` is `id String @id @default(cuid())`. Do not add ID generation in the handler.
3. **`slug` vs `id`.** Spec uses `[projectId]`; the param is the cuid PK. `lib/projects.ts`'s `slug` is a UI mock concept, not part of the API contract. No slug-based lookups.
4. **Race on ownership.** Between the find and the update/delete, an ownership transfer could in theory slip in. Not possible today (no transfer route) — flagged for the spec that introduces collaborators or ownership transfer.
5. **Clerk `auth()` in handlers.** Same import as in RSC: `const { userId } = await auth()` from `@clerk/nextjs/server`. Return 401 explicitly from the handler rather than letting Clerk's proxy throw — keeps the contract clear at the route level.
6. **oxfmt strictness.** Double quotes, no semicolons. Run `bun run fmt` after writing code so the formatter normalizes the file before `fmt:check`.
7. **Prisma generated client.** If `bun run build` complains about missing types, run `bunx prisma generate` once and rebuild. Do not edit files under `app/generated/prisma/`.
