# Spec 37 — Colocated unit tests (bun:test, DB-free)

Add fast, DB-free unit tests for pure logic using the repo's existing
runner **`bun:test`**. Do not add vitest. Do not create a root `tests/`
folder — tests live colocated next to sources as `*.test.ts`.

Grill decisions (locked):

- Runner: `bun:test` (existing `lib/projects-write.test.ts` pattern).
- Layout: colocated, not central.
- Scope: unit logic only. No API route handlers, no Liveblocks/Clerk
  network, no canvas hooks/components, no Prisma.
- DB: none. Every new test must pass without `DATABASE_URL`.

## Coverage

1. `lib/api/validation.ts` — all parsers:
   `parseCreateProjectBody`, `parseRenameProjectBody`,
   `parseInviteCollaboratorBody`, `parseLiveblocksAuthBody`,
   `parseDesignTriggerBody`, `parseDesignTokenBody`,
   `parseAssistantMessageBody`, `parseCanvasSaveBody`,
   `parseSpecTriggerBody`, `parseSpecTokenBody`, `parseSpecSaveBody`.
   - Happy path + trim/normalize behavior.
   - Unknown-field rejection (`INVALID_BODY`).
   - Missing/empty/over-length cases and per-parser codes
     (`INVALID_EMAIL`, `CANVAS_TOO_LARGE`, `SPEC_TOO_LARGE`).
2. `lib/projects.ts` — `slugify`: casing, trim, separator collapse,
   leading/trailing dash strip, empty result.
3. `lib/canvas/shape-definitions.ts` — `SHAPES` (6 entries, positive
   dims, unique names), `SHAPE_DRAG_MIME` constant,
   `generateShapeNodeId` (`<shape>-<ts>-<counter>`, per-shape counter
   increments).
4. `lib/liveblocks.ts` — `cursorColorForUserId`: empty id returns first
   palette slot, deterministic same-input same-output, result always in
   `CURSOR_COLORS`. Must not construct the `Liveblocks` client (needs
   `LIVEBLOCKS_SECRET_KEY` + `server-only`).
5. `lib/api/responses.ts` — `HttpError` fields, `json` content-type +
   body, `unauthorized`/`forbidden`/`notFound`/`badRequest`/`noContent`
   status+code shapes, `planLimitExceeded` flat details,
   `rateLimited` 429 headers.

Explicitly out of scope: `lib/projects-write.test.ts` (existing DB
concurrency test, untouched), route handlers, `prisma`, Trigger.dev
tasks, React components/hooks.

## Constraints

- `import { describe, expect, test } from "bun:test"`.
- Colocated: `lib/api/validation.test.ts`,
  `lib/projects.test.ts`, `lib/canvas/shape-definitions.test.ts`,
  `lib/liveblocks-color.test.ts` (name avoids colliding with
  `server-only` client import where possible — or mock env),
  `lib/api/responses.test.ts`.
- Reuse `types/bun-test.d.ts` ambient types. No new test deps.
- No `DATABASE_URL` required. No network. No timers abuse
  (`Date.now` stub only for id-pattern test).

## Check When Done

- `bun test` green with and without `DATABASE_URL` set.
- New files only under `lib/**` as `*.test.ts`; no `tests/`, no vitest
  config, no `package.json` test-runner changes.
- `bun run typecheck`, `bun run lint`, `bun run build` pass.
