Rate-limit expensive server surfaces with Upstash Ratelimit (sliding window) to prevent abuse of AI generation and Liveblocks token minting. Reuses the Spec 33 Redis client; fail-open when Redis is down.

## What to Install

- `@upstash/ratelimit` (production limiter built on `@upstash/redis`, per `patterns/rate-limiting.md`)
- `@upstash/redis@^1.38.4` already installed; no new env vars (reuses `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` via `Redis.fromEnv()`)

## Implementation

1. Add `lib/ratelimit.ts` (new, `import "server-only"`).
   - Lazily create one `Redis` client via `Redis.fromEnv()` on `globalThis` (same pattern as `lib/redis.ts` / `lib/prisma.ts`; do not import the private `getClient()` from `lib/redis.ts` — duplicate the 15-line lazy singleton so cache and limiter can evolve independently).
   - Export `isRateLimitEnabled()` (same check as `isCacheEnabled()`: both env vars present; false ⇒ skip limiting entirely, pure pass-through, zero errors — mirrors Spec 33 fail-open).
   - Define two sliding-window limiters with `prefix` under the `ghost:` namespace:
     - `aiLimiter` → `Ratelimit.slidingWindow(10, "60 s")`, prefix `ghost:ratelimit:ai` (conservative starter)
     - `liveblocksLimiter` → `Ratelimit.slidingWindow(120, "60 s")`, prefix `ghost:ratelimit:liveblocks`
   - Export `checkRateLimit(tier: "ai" | "liveblocks", identifier: string)` → `{ ok, limit, remaining, reset }`. Wraps `limiter.limit(identifier)` in try/catch + short timeout (reuse the 750ms `Promise.race` shape from `lib/redis.ts`); on any error log `console.warn` with tier + identifier and return `{ ok: true }` (fail-open — Redis-down never blocks).
   - Export `resolveRateLimitIdentifier(userId: string | null, request: Request): string` → `user:{userId}` when authed, else `ip:{ip}` where ip is first entry of `x-forwarded-for`, else `x-real-ip`, else `"unknown"` (lowercased, truncated to 64 chars). Keeps keys bounded and PII-free beyond what auth already holds.
   - `analytics: false`, no ephemeral cache, no manual JSON.

2. Extend `lib/api/responses.ts` with `rateLimited(limit, remaining, resetMs, retryAfterSec)`.
   - Returns `429 { error: { code: "RATE_LIMITED", message: "Too many requests, please retry shortly" } }` with headers `Retry-After: {retryAfterSec}`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (reset as epoch-ms to match `Ratelimit.limit()` output). No other response file changes.

3. Guard AI routes (tier `ai`, 10 req / 60 s per identity).
   - `POST /api/ai/design` (`app/api/ai/design/route.ts`), `POST /api/ai/spec` (`app/api/ai/spec/route.ts`), `POST /api/ai/chat/assistant` (`app/api/ai/chat/assistant/route.ts`), plus their token companions (`.../design/token`, `.../spec/token` — same `ai` tier so a token fetch consumes the same budget as the generation it authorizes).
   - Order inside each handler: auth (`requireUserId()` / `getCurrentIdentity()` → 401 on miss, quota NOT consumed) → `checkRateLimit("ai", resolveRateLimitIdentifier(userId, request))` → 429 on `ok === false` → existing body validation (400) → existing access checks (403/404) → expensive work (Prisma / Trigger / Groq / Blob). Rate check sits before any Prisma/Trigger/Liveblocks call so abuse never reaches billable work.

4. Guard token minting (tier `liveblocks`, 120 req / 60 s per identity).
   - `POST /api/liveblocks-auth` (`app/api/liveblocks-auth/route.ts`): same order — JSON parse → auth resolve (401, no quota) → `checkRateLimit("liveblocks", ...)` → 429 → `getAccessibleProject` (403) → `getOrCreateRoom`. Covers room-join spam without touching the Liveblocks Storage/Presence schema.

5. Fail-open everywhere (same contract as Spec 33 §5).
   - `isRateLimitEnabled() === false` (no env vars, local dev) behaves identically to Redis-down: skip `limit()`, run the existing handler path, zero errors, no status-code changes.
   - `limit()` throw/timeout/5xx ⇒ `console.warn` with tier + identifier, allow the request. Limiter errors never produce 500/502; routes keep their current 400/401/403/404/502 contracts from `lib/api/responses.ts`.

## Scope Limits

- No CRUD/project/collaborator/canvas/spec-Blob routes in this spec (`/api/projects*`, `.../collaborators*`, `.../canvas`, `.../specs` list/download stay unlimited; follow-up spec can add a loose 60 req / 60 s tier if smoke tests show abuse).
- No client-component/hook changes (AI sidebar keeps current error surfacing; a 429 countdown/toast is an explicit follow-up, not this spec).
- No changes to Trigger.dev tasks, Liveblocks Storage/Presence schema, Vercel Blob paths, or Prisma models/migrations.
- No new API routes; limiting is internal to the six existing handlers above.
- No PII beyond Clerk userId / request IP already visible to the handlers; Redis keys hold counters only.

## Notes

- Check `context/project-overview.md` and `context/architecture-context.md` before implementing — invariant 1 (request handlers stay thin; long-lived AI work stays in Trigger.dev) still applies; the limiter is a pre-gate, never a replacement for auth/ownership checks.
- Follow the `upstash-redis-js` skill `patterns/rate-limiting.md`: production path is `@upstash/ratelimit` with `Ratelimit.slidingWindow` (not hand-rolled INCR/ZADD counters); `Redis.fromEnv()` only, never hardcoded credentials.
- Reuse existing gates: `requireUserId()`, `getCurrentIdentity()`, `getAccessibleProject()` stay the authority; the limiter runs after auth so 401s never consume quota and one user can never consume another's budget (per-identity keys).
- Key hygiene: `ghost:ratelimit:{tier}:{user|ip}:{value}` via the SDK `prefix` option; every counter key gets the SDK-managed TTL (no keys without TTL).

## Check When Done

- `@upstash/ratelimit` installed; `lib/ratelimit.ts` builds limiters on `Redis.fromEnv()` with no hardcoded credentials.
- 11th AI request within 60 s returns `429 { error: { code: "RATE_LIMITED" } }` with `Retry-After` + `X-RateLimit-*` headers; 121st `liveblocks-auth` request in 60 s does the same; quota resets after the window without a restart.
- Authed requests key by `user:{userId}`; unauthenticated-shape requests (no session) fall back to `ip:{ip}` and still 401 before any billable work.
- App works with `UPSTASH_REDIS_REST_URL`/`TOKEN` unset (pure pass-through, no errors) and with Redis-down (warn + allow, no status-code changes).
- No Blob, Trigger.dev task, Liveblocks schema, Prisma, or client-behavior changes.
- `bunx next typegen`, `bun run typecheck`, `bun run lint`, and `bun run build` pass.
