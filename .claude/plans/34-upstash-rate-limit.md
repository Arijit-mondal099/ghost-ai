# Plan: 34 Upstash Rate Limit — sliding-window pre-gate for AI + Liveblocks token routes

## Context

Spec `.claude/context/specs/34-upstash-rate-limit.md` rate-limits expensive
server surfaces with `@upstash/ratelimit` (sliding window), reusing the Spec
33 Redis env vars. Fail-open everywhere: Redis-down or unset env behaves
identically to no limiter.

**Current state (verified):**

- `lib/redis.ts:35-59` — `isCacheEnabled()` + lazy `Redis.fromEnv()`
  singleton on `globalThis`; 750ms `Promise.race` fail-open pattern to copy.
- `lib/api/responses.ts:38-46` — `unauthorized/forbidden/notFound/badRequest`
  only; no 429 helper yet.
- AI routes follow auth → parse → access → expensive work:
  `app/api/ai/design/route.ts:38`, `app/api/ai/spec/route.ts:41`,
  `app/api/ai/chat/assistant/route.ts:29`,
  `app/api/ai/design/token/route.ts:39`, `app/api/ai/spec/token/route.ts:41`.
- `app/api/liveblocks-auth/route.ts:57` — JSON parse → `resolveAccess`
  (auth + body) → `getAccessibleProject` 403 → `getOrCreateRoom` →
  `identifyUser`.
- `package.json:31` — `@upstash/redis@^1.38.4` installed;
  `@upstash/ratelimit` not installed — one `bun add` needed. No new env vars.
- Invariant 1 holds: the limiter is a pre-gate before Prisma/Trigger/
  Liveblocks, never a replacement for auth/ownership checks.

**Locked decisions:** two tiers (`ai`: 10/60s, `liveblocks`: 120/60s),
`ghost:ratelimit:*` prefix namespace, `checkRateLimit(tier, identifier)` →
`{ ok, limit, remaining, reset }`, 429 shape
`{ error: { code: "RATE_LIMITED" } }` with `Retry-After` + `X-RateLimit-*`,
fail-open with `console.warn`. `retryAfterSec` centralized inside
`rateLimited(resetMs)` (one formula, six identical callers).

## Files to Create

```
lib/ratelimit.ts   # singleton + isRateLimitEnabled + 2 limiters + checkRateLimit + resolveRateLimitIdentifier
```

## Files to Modify

1. `lib/api/responses.ts` — add `rateLimited(limit, remaining, resetMs, retryAfterSec?)` only.
2. `app/api/ai/design/route.ts` — `ai`-tier gate after `requireUserId`, before body validation.
3. `app/api/ai/spec/route.ts` — same.
4. `app/api/ai/chat/assistant/route.ts` — same.
5. `app/api/ai/design/token/route.ts` — same (`ai` tier, shared budget).
6. `app/api/ai/spec/token/route.ts` — same (`ai` tier, shared budget).
7. `app/api/liveblocks-auth/route.ts` — `liveblocks`-tier gate after `resolveAccess`, before `getAccessibleProject`.
8. `package.json` + `bun.lock` — via `bun add @upstash/ratelimit`.
9. `.claude/context/progress-tracker.md` — record implementation state.

No CRUD/collaborator/canvas/spec-Blob routes, no client/hook changes, no
Trigger/Liveblocks-schema/Blob/Prisma changes, no new routes.

## Design

### `lib/ratelimit.ts` (new, `import "server-only"`)

- Duplicate the ~15-line lazy `Redis.fromEnv()` singleton from
  `lib/redis.ts:46-59` on its own `globalThis` slot (`ratelimitRedisGlobal`)
  so cache and limiter evolve independently. Only successful clients cached.
- `isRateLimitEnabled()` — both `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` present and non-empty. False ⇒ callers skip
  `limit()` entirely (pure pass-through, zero errors).
- Two limiters, `analytics: false`, no ephemeral cache:
  `slidingWindow(10, "60 s")` with prefix `ghost:ratelimit:ai`;
  `slidingWindow(120, "60 s")` with prefix `ghost:ratelimit:liveblocks`.
  Lazy-init alongside the client, cached on `globalThis`.
- `checkRateLimit(tier, identifier)` → `{ ok, limit, remaining, reset }`.
  Wraps `limiter.limit(identifier)` in the 750ms `Promise.race` shape from
  `lib/redis.ts:61-80` (unique-symbol sentinel, timer cleared in `finally`);
  on timeout/throw/5xx, `console.warn` with tier + identifier and return
  `{ ok: true }` (fail-open, no limit fields).
- `resolveRateLimitIdentifier(userId | null, request)` → `user:{userId}`
  when authed, else `ip:{ip}` from first `x-forwarded-for` entry, else
  `x-real-ip`, else `"unknown"` (lowercased, truncated to 64 chars). Since
  the limiter runs after auth on all six routes, the IP branch is a safety
  net — 401s return before quota is consumed.

### `lib/api/responses.ts` (+1 export)

- `rateLimited(limit, remaining, resetMs, retryAfterSec?)` → `429`
  `{ error: { code: "RATE_LIMITED", message: "Too many requests, please retry shortly" } }`
  with `Retry-After` (defaults to `max(1, ceil((resetMs - now) / 1000))`),
  `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  (epoch-ms passthrough). Built on `json()`; nothing else changes.

### Route guards (identical shape per route)

- AI routes (design, spec, assistant, both tokens): insert after the
  `requireUserId` try/catch, before `request.json()`. Order: 401 → 429 →
  400 → 403/404 → billable work. Token companions use the `ai` tier.
- `liveblocks-auth`: insert after `resolveAccess`, before
  `getAccessibleProject`. Order: 401/400 → 429 → 403 → `getOrCreateRoom`.

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt` (touched files) →
  `build` clean.
- Maps to spec Check-When-Done: 11th AI request in 60s → 429
  `RATE_LIMITED` with all four headers; 121st `liveblocks-auth` → same;
  window resets without restart; authed keys are `user:{id}`; unset env →
  pure pass-through; Redis-down → warn + allow, existing
  400/401/403/404/502 contracts unchanged.
- Live matrix (needs Upstash env + Neon + Clerk session): burst each tier
  past its cap, confirm 429 + headers, confirm reset, confirm disabled-env
  and Redis-down paths allow traffic.

## Risks

- **Shared AI budget:** token fetches burn the same 10/60s as generations
  (spec-mandated). Aggressive token-mint retries can starve a client's own
  generations — accepted as conservative starter; follow-up can split tiers.
- **Two Redis clients:** deliberate duplication per spec; negligible cost
  (REST, no pooling).
- **`limit()` latency on the hot path:** one REST round-trip pre-gate,
  bounded by the 750ms race; fail-open means p99 degrades to allow, never
  to 500.
