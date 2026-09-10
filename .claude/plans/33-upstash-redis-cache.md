# Plan: 33 Upstash Redis Cache — cache-aside for hot project metadata

## Context

Spec `.claude/context/specs/33-upstash-redis-cache.md` caches hot project
metadata in Upstash Redis (cache-aside) to cut repeated Prisma reads on
every workspace load and API call. Prisma stays the source of truth; Blob
stays the artifact store (invariants 1–3 hold; the cache is a read
accelerator, never authority).

**Current state (verified):**

- `lib/project-access.ts:44` — `getAccessibleProject()` gates every
  `app/api/*` route + `liveblocks-auth`. One `findFirst` per call.
- `lib/projects-data.ts:26` — `getProjectsForCurrentUser()` runs two
  `findMany` per `/editor` load (owned + shared).
- `app/api/projects/[projectId]/collaborators/route.ts:141` — `GET` runs
  2 Prisma queries + up to N Clerk lookups per call.
- `app/api/projects/[projectId]/specs/route.ts:160` — `GET` runs 1 Prisma
  query per call.
- `lib/prisma.ts:27` / `lib/liveblocks.ts:45` — `globalThis` singleton
  pattern to copy. `@upstash/redis` installed (`1.38.4`).
- `upstash-redis-js` skill vendored (`patterns/caching.md`,
  `performance/ttl-expiration.md`).

**Locked decisions:** access invalidation via **generation counter**
(`ghost:accessver:{projectId}`, `INCR` on membership change, version
embedded in access keys); fail-open timeout **750ms** via `Promise.race`.

## Files to Create

```
lib/redis.ts   # singleton + isCacheEnabled/cacheGet/cacheSet/cacheDel + access-version helpers
```

## Files to Modify

1. `lib/project-access.ts` — cache `getAccessibleProject()` (60s, versioned key).
2. `lib/projects-data.ts` — cache `getProjectsForCurrentUser()` (60s).
3. `app/api/projects/[projectId]/collaborators/route.ts` — cache `GET`
   (60s); invalidate on `POST`.
4. `app/api/projects/[projectId]/collaborators/[collaboratorId]/route.ts`
   — invalidate on `DELETE`.
5. `app/api/projects/[projectId]/specs/route.ts` — cache `GET` (120s);
   invalidate on `POST`.
6. `app/api/projects/route.ts` — invalidate on `POST`.
7. `app/api/projects/[projectId]/route.ts` — invalidate on `PATCH`/`DELETE`.
8. `.claude/context/progress-tracker.md` — record implementation state.

No Blob, Trigger.dev, Liveblocks, client-component, Prisma-schema, or
new-route changes. `.env.local` gets the two `UPSTASH_REDIS_*` vars by
human hand (gitignored, never committed).

## Design

### `lib/redis.ts` (new, `import "server-only"`)

- `Redis.fromEnv()` only, lazy singleton on `globalThis` (dev hot-reload
  safe, same shape as `lib/prisma.ts` / `lib/liveblocks.ts`). Only
  successful clients are cached; a missing-env start returns `null` and
  retries on the next call.
- `isCacheEnabled()` — both env vars present and non-empty. False ⇒ pure
  DB path, zero errors.
- Internal `withTimeout(work, op, key)` — `Promise.race` against a 750ms
  timer (unique-symbol sentinel, timer cleared in `finally`). Timeout logs
  `console.warn` with key + op and degrades to a miss.
- `cacheGet<T>(key)` → `T | null`; `cacheSet(key, value, exSeconds)` →
  void (`{ ex }` in seconds on every set); `cacheDel(...keys)` → void.
  All fail-open with `console.warn`. Native types only — no manual
  `JSON.stringify`/`JSON.parse`.
- Access generation: `getAccessVersion(projectId)` → counter value as
  string, `"0"` when the counter key is absent (healthy Redis, never
  bumped), `null` when disabled/timed-out/errored (caller skips cache and
  goes to Prisma — avoids a double 750ms stall when Redis is down).
  `bumpAccessVersion(projectId)` → `INCR` + `EXPIRE` 24h (dead projects
  don't leak counter keys), fail-open.
- Key builders + TTL consts exported for routes:
  `ghost:access:{projectId}:{userId}:v{ver}` (60s),
  `ghost:projects:{userId}` (60s), `ghost:collabs:{projectId}` (60s),
  `ghost:specs:{projectId}` (120s). Emails lowercased in key segments.

### Read paths (cache-aside: `cacheGet` → hit returns, miss queries then `cacheSet`)

- `getAccessibleProject()` keys by **`userId`** (unique per Clerk user ⇒
  per-user isolation; email-set drift bounded by 60s TTL; membership
  changes bump the version). Only non-null results are stored — a null
  (no access) is never cached. `liveblocks-auth` benefits automatically.
- `getProjectsForCurrentUser()` caches the `{ owned, shared }` pair
  (plain JSON-safe rows, no `Date` objects).
- Collabs `GET` caches the enriched `{ owner, collaborators }` payload
  (Clerk names/avatars may lag ≤60s — accepted). Specs `GET` caches
  `{ specs: [{ id, createdAt }] }` (ISO strings already).

### Invalidation (delete-only, never write-through; failures log + continue)

- `POST /api/projects` → `del ghost:projects:{ownerId}`.
- `PATCH` project → `del projects:{ownerId}` + version bump +
  `del collabs:{projectId}`. `DELETE` → plus `del specs:{projectId}`.
- Collab invite/remove → `del collabs:{projectId}` + version bump.
  Invitee `ghost:projects:*` is a documented no-op: `findUserByEmail`
  (`lib/clerk-users.ts:62`) returns `EnrichedUser` with no Clerk `userId`,
  so the invitee key is unresolvable without widening the Clerk helper
  (out of scope) — the 60s TTL covers it per the spec's best-effort clause.
- Spec save → `del specs:{projectId}`.

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt` (touched files) →
  `build` clean.
- Maps to spec Check-When-Done: second call hits Redis on all four keys;
  Redis-down/unset-env ⇒ Prisma path with unchanged 401/403/404 contracts
  (`lib/api/responses.ts` untouched); rename visible within TTL without
  restart; no Blob/Trigger/Liveblocks/client changes.
- Live matrix (needs Upstash env + Neon + Clerk session): cold → miss,
  warm → hit; invite/remove → collabs + access refresh; rename → list
  refresh; spec save → specs list refresh; unset vars → works, no errors.

## Risks

- **Version-read round-trip:** cached access reads cost two Redis calls
  (version + value) — both sub-10ms typical, no key scans.
- **Counter cold start:** a fresh/expired counter starts a new generation;
  old versioned keys miss (safe direction: miss ⇒ DB read, never stale hit).
- **`GET /api/projects` (owned-only list) left uncached:** the spec's
  `ghost:projects` key is the `getProjectsForCurrentUser()` result (editor
  shell path). Extending it to the API list route is a follow-up.
