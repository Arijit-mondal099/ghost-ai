# Plan 37 — Colocated unit tests (bun:test, DB-free)

Source spec: `.claude/context/specs/37-colocated-unit-tests.md`
Status: drafted — awaiting approval before implementation.

## Locked decisions

1. **Runner (bun:test, recommended):** repo already uses `bun:test`
   (`lib/projects-write.test.ts` + `types/bun-test.d.ts`). No vitest,
   no new deps.
2. **Layout (colocated):** `*.test.ts` next to sources. No root `tests/`.
3. **Scope (unit only):** pure functions in `lib/`. No handlers, no DB,
   no network, no components/hooks.
4. **DB-free:** all new tests pass without `DATABASE_URL`. Existing
   DB-gated test untouched.

## Changes

1. **`lib/api/validation.test.ts` (new)** — per parser: ok-path,
   trim/lowercase/defaults, unknown-field `INVALID_BODY`, null/non-object
   bodies, empty + over-length (`120`, `4000`, `AI_CHAT_CONTENT_MAX_LENGTH`,
   5 MB canvas/spec, 500 KB save, 50 chat msgs, 200 nodes / 400 edges).
   Codes: `INVALID_EMAIL`, `CANVAS_TOO_LARGE`, `SPEC_TOO_LARGE`.
2. **`lib/projects.test.ts` (new)** — `slugify` table: upper→lower,
   trim, `[^a-z0-9]+`→`-`, edge dashes, empty string.
3. **`lib/canvas/shape-definitions.test.ts` (new)** — `SHAPES` length 6,
   positive dims, unique names; `SHAPE_DRAG_MIME` string;
   `generateShapeNodeId` regex `^<shape>-\d+-\d+$` + counter increments.
4. **`lib/liveblocks-color.test.ts` (new)** — import only
   `cursorColorForUserId` + `CURSOR_COLORS` to avoid `server-only` /
   secret env at import. Empty→slot 0, deterministic, membership.
5. **`lib/api/responses.test.ts` (new)** — `HttpError` status/code/message;
   `json` content-type + round-trip; each shortcut status + `error.code`;
   `planLimitExceeded` flat details; `rateLimited` 429 + headers
   (`Retry-After`, `X-RateLimit-*`).
6. **No changes** to `package.json` scripts, `types/bun-test.d.ts`,
   `lib/projects-write.test.ts`, routes, prisma, trigger.

## Verification

- `bun test` green with `DATABASE_URL` set and unset.
- `bun run typecheck` → `bun run lint` → `bun run build`.
- `git status` shows only the 5 new `*.test.ts` + spec/plan files.
