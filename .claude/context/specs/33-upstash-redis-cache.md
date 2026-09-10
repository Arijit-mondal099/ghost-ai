Cache hot project metadata in Upstash Redis (cache-aside) to cut repeated Prisma reads on every workspace load and API call.

## What to Install

- `@upstash/redis` (serverless HTTP client, no connection pooling needed)

## Implementation

1. Provisioning and config (human step, not code).
   - Human creates/claims a production Upstash Redis database in the Upstash console.
   - Human pastes `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into `.env.local` (gitignored, never committed).
   - Code reads credentials only via `Redis.fromEnv()` — never hardcode URL/token.

2. Add a Redis singleton in `lib/redis.ts`.
   - Lazily create one `Redis` client via `Redis.fromEnv()` following the `lib/prisma.ts` / `lib/liveblocks.ts` `globalThis` cache pattern (dev hot-reload safe).
   - Export small helpers: `isCacheEnabled()` (false when env vars missing, so local dev without Redis still works), `cacheGet<T>(key)`, `cacheSet(key, value, exSeconds)`, `cacheDel(...keys)` — each fail-open (see §5).
   - Let the SDK auto-serialize native JS types (per the `upstash-redis-js` skill). No manual `JSON.stringify`/`JSON.parse`.

3. Cache hot metadata reads only (cache-aside / lazy loading).
   - Key namespace `ghost:{domain}:{id}`, all values with short TTLs:
     - `ghost:access:{projectId}:{userIdOrEmailKey}` → result of `getAccessibleProject()` in `lib/project-access.ts` (the gate behind every `app/api/*` route + `liveblocks-auth`). TTL 60 s. Stale window is acceptable because mutations invalidate ( §4); 60 s bounds the damage of a missed invalidation on access revocation.
     - `ghost:projects:{userId}` → result of `getProjectsForCurrentUser()` in `lib/projects-data.ts` (owned + shared lists for `/editor` home + workspace shell). TTL 60 s.
     - `ghost:collabs:{projectId}` → enriched `{ owner, collaborators }` payload served by `GET /api/projects/[projectId]/collaborators`. TTL 60 s.
     - `ghost:specs:{projectId}` → `{ specs: [{ id, createdAt }] }` payload served by `GET /api/projects/[projectId]/specs`. TTL 120 s (specs are append-only; no rename path to go stale).
   - Read path per key: `cacheGet` → hit returns immediately; miss runs the existing Prisma/Clerk query, then `cacheSet` with the TTL above, then returns.
   - Do NOT cache: canvas JSON bytes, spec Markdown bytes, Vercel Blob responses, `TaskRun` rows, Liveblocks tokens, Trigger.dev tokens. Prisma stays the source of truth; Blob stays the artifact store (per `architecture-context.md` storage model).

4. Invalidate on writes (no write-through of values, just delete stale keys).
   - Project create (`POST /api/projects`): `del ghost:projects:{ownerId}`.
   - Project rename/delete (`PATCH`/`DELETE /api/projects/[projectId]`): `del ghost:projects:{ownerId}`, `ghost:access:{projectId}:*` (scan-free: track per-project member key set or use a version suffix — prefer a `ghost:accessver:{projectId}` generation counter bumped on membership change, checked on read), `ghost:collabs:{projectId}`, `ghost:specs:{projectId}` on delete.
   - Collaborator invite/remove (`POST`/`DELETE .../collaborators*`): `del ghost:collabs:{projectId}`, bump access generation for the project, `del ghost:projects:{inviteeUserId}` where resolvable (best-effort; TTL covers the miss).
   - Spec save (`POST /api/projects/[projectId]/specs`): `del ghost:specs:{projectId}`.
   - Invalidation failures never fail the mutation — log and continue (fail-open both directions).

5. Fail-open everywhere.
   - Every Redis call is wrapped in try/catch with a short timeout. On any error (missing env, network, timeout, 5xx): log a server-side warning with the key + operation, skip the cache, and fall through to the existing Prisma/Blob path.
   - Cache errors never change HTTP status codes: no new 500/502 branches for Redis. Routes keep their current 401/403/404 contracts from `lib/api/responses.ts`.
   - `isCacheEnabled() === false` (no env vars) must behave identically to Redis-down: pure DB path, zero errors.

## Scope Limits

- No canvas or spec body caching (Vercel Blob read path unchanged).
- No rate limiting (`@upstash/ratelimit`), session storage, queues, locks, or search indexes in this spec.
- No changes to Trigger.dev tasks, Liveblocks Storage/Presence schema, or client components/hooks.
- No new Prisma models or migrations.
- No new API routes; caching is internal to existing helpers/routes.
- No PII beyond what Prisma already returns (owner/collaborator emails already flow through these payloads; no new data classes enter Redis).

## Notes

- Check `context/project-overview.md` and `context/architecture-context.md` before implementing — invariants 2 (metadata vs artifacts in separate layers) and 3 (auth/ownership at every mutation boundary) still apply; the cache is a read accelerator, never an authority.
- Follow the `upstash-redis-js` skill: `patterns/caching.md` (cache-aside + invalidate) and `performance/ttl-expiration.md` (short explicit TTLs on every key).
- Reuse existing gates: `requireUserId()`, `getAccessibleProject()`, `resolveReadAccess`/`resolveWriteAccess` stay the authority; cached values are per-user/per-project so one user can never read another's cached row.
- Key hygiene: lowercase emails in key segments; `ex` passed as seconds on every `set`; no keys without TTL.

## Check When Done

- `@upstash/redis` is installed; `lib/redis.ts` singleton uses `Redis.fromEnv()` with no hardcoded credentials.
- Workspace/API reads hit Redis on the second call (access, project list, collaborators, specs list) and fall back to Prisma on miss or Redis-down with no status-code changes.
- Mutations invalidate their keys (create/rename/delete, invite/remove, spec save); a rename is visible within the TTL without a restart.
- App works with `UPSTASH_REDIS_REST_URL`/`TOKEN` unset (pure DB path, no errors).
- No Blob, Trigger.dev, Liveblocks, or client-behavior changes.
- `bun run typecheck`, `bun run lint`, and `bun run build` pass.
