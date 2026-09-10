# 35 — Rate-limit UX: visible feedback when a limiter hits

## Problem

When Upstash rate limiting (spec 34) rejects a request, the user gets no
usable signal in the worst case:

- `POST /api/liveblocks-auth` → 429: the Liveblocks client treats 429 as a
  retryable auth error (`NON_RETRY_STATUS_CODES` in `@liveblocks/core` is
  `[400, 401, 403, 404, ...]` — 429 is absent) and retries silently forever.
  `ClientSideSuspense` never resolves, so the canvas sits on "Connecting…"
  with no message, no countdown, and no retry action.
- AI sidebar 429s do surface (the hook posts the server's
  `{ error: { message } }` as a Ghost message), but without the `Retry-After`
  timing, so the user cannot tell _when_ to retry.

## Implementation

1. `components/editor/canvas/canvas-room.tsx` — switch `LiveblocksProvider`
   from the `authEndpoint="/api/liveblocks-auth"` string to a custom async
   function (same wire format: `POST { room }`).
   - 200 → return `{ token }` passthrough (parsed from the JSON body).
   - 429 → capture `Retry-After` into component state and return
     `{ error: "forbidden", reason: "rate-limited" }` so the client
     _stops_ retrying (`StopRetrying` path in `@liveblocks/core`). This
     makes the failure deterministic: no silent background loop, no
     surprise re-auth timing — the UI owns the retry schedule.
   - Any other non-OK → `throw new Error(...)` (preserves today's retry
     behavior for 5xx/network).
   - Own an `attempt` counter used as `key` on `LiveblocksProvider`;
     bumping it remounts the provider stack for a fresh auth attempt and
     clears the rate-limit state.
2. `components/editor/canvas/rate-limit-overlay.tsx` (new, presentational,
   client-safe) — absolute overlay over the canvas area, rendered when the
   rate-limit state is set (above the stuck "Connecting…" fallback):
   warning icon, "Too many requests" heading, live countdown derived from
   `Retry-After`, "Retry now" button. Auto-fires `onRetry` when the
   countdown reaches 0 (bounded loop: a still-limited server answers 429
   again with a fresh `Retry-After`). `role="alert"` + `aria-live` so
   assistive tech announces it. Dark tokens only (`bg-base`, `text-warning`,
   `border-surface-border`, etc. — no hardcoded hex).
3. `hooks/use-design-agent.ts` + `hooks/use-spec-generation.ts` — in each
   `readErrorMessage(response)`, special-case `response.status === 429`:
   append the `Retry-After` value (`"... (retry in Ns)"`). No new
   components, no countdown in chat — the static retry timing is enough
   next to the Ghost error message.

## Scope Limits

- No changes to limiter tiers, windows, keys, or fail-open behavior
  (`lib/ratelimit.ts`, `lib/api/responses.ts` untouched, except reverting
  the TEMP-UI-TEST values — see Notes).
- No new API routes; no Trigger.dev, Blob, Prisma, or Liveblocks
  Storage/Presence schema changes.
- No changes to `CanvasErrorFallback` (genuine connection errors keep the
  current "Connection lost — refresh to retry" surface).
- No toast system, no global 429 listener, no countdown in the AI chat
  itself.

## Notes

- The TEMP-UI-TEST limits in `lib/ratelimit.ts` (`ai` 2/60s,
  `liveblocks` 3/60s) are still in place for manual testing. Revert to
  `10` / `120` before shipping this spec's work (verification step 1
  below is easier _with_ the temp values; the final gate run happens
  after the revert).
- `resolveRateLimitIdentifier` / `checkRateLimit` need no changes; the
  server already sends `Retry-After` + `X-RateLimit-*` on every 429.

## Check When Done

- With temp `liveblocks` 3/60s: 4th quick editor reload shows the overlay
  (heading + live countdown + Retry now) instead of endless
  "Connecting…"; countdown expiry auto-reconnects after the window;
  "Retry now" reconnects immediately once the window has passed; a
  still-limited retry shows a fresh countdown.
- With temp `ai` 2/60s: second rapid sidebar prompt posts a Ghost error
  containing "(retry in Ns)"; same for the Generate Spec button path.
- `bunx next typegen`, `bun run typecheck`, `bun run lint`,
  `bun run fmt` (touched files), and `bun run build` pass.
