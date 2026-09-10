# Plan: 35 Rate-limit UX — visible feedback when a limiter hits

## Context

Spec `.claude/context/specs/35-rate-limit-ux.md`. Spec 34 deferred all
client surfacing ("a 429 countdown/toast is an explicit follow-up"); the
manual test proved the gap — a `liveblocks-auth` 429 leaves the canvas on
"Connecting…" forever.

**Current state (verified):**

- `components/editor/canvas/canvas-room.tsx:269` —
  `<LiveblocksProvider authEndpoint="/api/liveblocks-auth">` (string form).
  `ClientSideSuspense` fallback is the "Connecting…" text (`:283-288`);
  `CanvasErrorFallback` (`:93-103`) only renders on thrown errors.
- `@liveblocks/core` (`node_modules/@liveblocks/core/dist/index.js:6636`):
  `NON_RETRY_STATUS_CODES = [400, 401, 403, 404, 405, 410, 412, 414, 422]`
  — 429 is absent, so the string endpoint's `Failed to authenticate`
  throw is retried silently forever. Custom callbacks may return
  `{ token }`, `{ error: "forbidden", reason }` (→ `StopRetrying`, client
  gives up), or `{ error: <other>, reason }` (→ retryable throw)
  (`index.d.ts:152`).
- `hooks/use-design-agent.ts:76` + `hooks/use-spec-generation.ts:80` —
  `readErrorMessage(response)` posts the server message as a Ghost
  message; 429 body is already "Too many requests, please retry shortly"
  but carries no timing.
- `lib/ratelimit.ts` still carries TEMP-UI-TEST limits (`ai` 2/60s,
  `liveblocks` 3/60s) — kept for verification, reverted at the end.

**Locked decision:** custom auth function + `{ error: "forbidden" }` to
stop the client's silent retry loop, UI-owned retry schedule (countdown
auto-retry + manual button). No reliance on client backoff timing or on
RoomProvider throwing to the boundary.

## Files to Create

```
components/editor/canvas/rate-limit-overlay.tsx   # presentational overlay: icon + heading + countdown + retry
```

## Files to Modify

1. `components/editor/canvas/canvas-room.tsx` — custom `authEndpoint`
   fn, `rateLimit` + `attempt` state, overlay mount, `key={attempt}`.
2. `components/editor/index.ts` — barrel re-export (check current
   canvas exports first; follow the existing pattern).
3. `hooks/use-design-agent.ts` — 429 branch in `readErrorMessage`.
4. `hooks/use-spec-generation.ts` — same 429 branch.
5. `lib/ratelimit.ts` — revert TEMP-UI-TEST values to `10` / `120`
   (last step before gates).
6. `.claude/context/progress-tracker.md` — record implementation state.

No server, Trigger, Blob, Prisma, schema, or fallback-component changes.

## Design

### `canvas-room.tsx` — custom auth function

```tsx
const [rateLimit, setRateLimit] = useState<{ retryAfterSec: number; at: number } | null>(null);
const [attempt, setAttempt] = useState(0);

const authEndpoint = useCallback(
  async (room?: string): Promise<{ token: string } | { error: "forbidden"; reason: string }> => {
    const res = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room }),
    });
    if (res.status === 429) {
      const retryAfterSec = Math.max(1, parseInt(res.headers.get("Retry-After") ?? "", 10) || 60);
      setRateLimit({ retryAfterSec, at: Date.now() });
      return { error: "forbidden", reason: "rate-limited" };
    }
    if (!res.ok) throw new Error(`Liveblocks auth failed (${res.status})`);
    const data: unknown = await res.json();
    // Route returns the SDK's `{ token }` body verbatim.
    return { token: (data as { token: string }).token };
  },
  [],
);

const retryAuth = useCallback(() => {
  setRateLimit(null);
  setAttempt((a) => a + 1);
}, []);
```

- `<LiveblocksProvider authEndpoint={authEndpoint} key={attempt}>` —
  remount gives a fresh client + fresh auth attempt.
- Wrap the `RoomProvider` subtree in a `div.relative.h-full.w-full` and
  render `{rateLimit && <RateLimitOverlay retryAfterSec={rateLimit.retryAfterSec} onRetry={retryAuth} />}`
  as an absolute sibling above the suspense fallback. `children`
  (dialog slot) stays where it is.
- Non-429 failures keep today's behavior exactly (throw → client
  retries; boundary fallback unchanged).

### `rate-limit-overlay.tsx` (new)

- Props `{ retryAfterSec: number; onRetry: () => void }`. Owns
  `remaining` state (init `retryAfterSec`), `setInterval` 1s decrement,
  cleanup on unmount; calls `onRetry()` once when hitting 0 (guard ref
  against double-fire under StrictMode).
- Layout: `absolute inset-0 z-50 flex items-center justify-center
bg-base/95 backdrop-blur-md`; card with `TriangleAlertIcon`
  (`text-warning`), "Too many requests" heading (`text-copy-primary`),
  `Your connection was rate limited. Retrying in {remaining}s…`
  (`text-copy-muted`, `aria-live="polite"`), Retry now `Button`
  (`onClick={onRetry}`). Root `role="alert"`. Tokens only, no hex.
- Countdown is cosmetic-proof: it derives from the server's
  `Retry-After`; if the server still limits, the next 429 sets a fresh
  state and the overlay re-counts (key overlay by `attempt` or by the
  `at` timestamp so `remaining` resets).

### Sidebar 429 enrichment (both hooks)

Inside each `readErrorMessage`, after the body parse, before the
status fallback:

```ts
if (response.status === 429) {
  const retry = response.headers.get("Retry-After");
  const secs = retry !== null ? Math.max(1, parseInt(retry, 10) || 60) : null;
  return secs !== null ? `${message} (retry in ${secs}s)` : message;
}
```

(`message` = parsed body message or the `Request failed (429)`
fallback.) Three lines per hook, no signature changes — callers
already pass the full `Response`.

## Verification

- With temp limits still in place: 4th quick reload → overlay with live
  countdown (not "Connecting…"); expiry auto-reconnects; Retry now
  works; 2nd rapid sidebar prompt → Ghost "(retry in Ns)" message;
  same via Generate Spec.
- Revert temp values → `next typegen` → `typecheck` → `lint` → `fmt`
  → `build` clean → runtime re-check at production limits is N/A
  (caps too high to hit by hand; logic identical, only the window
  constants change).
- No Blob/Trigger/Prisma/client-behavior changes beyond the two
  surfaces above.

## Risks

- **`{ error: "forbidden" }` also ends the client's retry for that
  auth attempt** — intended (UI owns retries now), and each remount
  starts clean. A genuinely-forbidden user (403) never reaches this
  path: 403 still throws → existing retry/boundary behavior.
- **Auto-retry loop while limited** — bounded by design: each cycle
  costs exactly one cheap `liveblocks-auth` 429 (no room creation, no
  billable work) and backs off per the server's `Retry-After`.
- **StrictMode double-mount** — auth fn may run twice; both calls
  consume quota (server-side, unavoidable with any retry), overlay
  state is idempotent (last write wins, same shape).
