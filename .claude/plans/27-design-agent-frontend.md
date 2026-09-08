# Plan: 27 Design Agent Frontend — Sidebar Submit + `useRealtimeRun` + Status Strip

## Context

Spec `.claude/context/specs/27-design-agent-frontend.md` wires the AI sidebar
to the design-agent backend: submit prompts, track run status in real time,
and reflect AI-driven canvas updates through Liveblocks.

**What already exists (do not rebuild):**

- `POST /api/ai/design` takes `{prompt, projectId, roomId}`, returns `{runId}`
  (201). `POST /api/ai/design/token` takes `{runId}`, returns `{token}`
  (scoped `read: {runs: [runId]}`). Both live in `app/api/ai/design/`
  (spec 23, built).
- `hooks/useAiChatFeed` (`hooks/use-ai-chat-feed.ts`) — ephemeral `AI_CHAT`
  RoomEvent chat, optimistic user send, `send()` hardcodes `role: "user"`.
  Validator `isAiChatFeedPayload` in `types/tasks.ts` already allow-lists
  `"assistant"`.
- `hooks/useDesignAgent` (`hooks/use-design-agent.ts`) — POSTs the prompt,
  tracks `AI_STATUS` RoomEvents (`start|processing|complete|error`), exposes
  `{stage, lastMessage, isActive, start}` plus an `onTerminal(message, ok)`
  callback that fires once per own run (StrictMode-safe). Display state
  follows every validated room event; `runId`/`publicToken` teardown and
  `onTerminal` are scoped to `event.runId ===` local `runId` (via a ref
  mirror), so one room's terminal event can never reset another run or emit
  an unrelated assistant message — the initiator is the single producer.
- Sidebar renders inside `RoomProvider` (via the `CanvasRoom` children slot in
  `editor-workspace-client.tsx`), so `useRealtimeRun` and `useEventListener`
  both resolve with no layout change.
- Canvas graph is owned by `useLiveblocksFlow` in `canvas-room.tsx` — AI
  node/edge writes appear automatically. **Zero canvas code in this plan.**
- `@trigger.dev/react-hooks@4.5.16` is installed. Per the realtime skill:
  guard subscribes with `enabled`, pass `skipColumns: ["payload","output"]`
  for status-only use, hooks need `"use client"` (all touched files already
  have it).

**Approved decisions (user answered clarifying questions):**

- API contract → two-step existing API (`POST /design` then
  `POST /design/token`). No backend changes, respects the spec's
  "do not implement backend logic" scope limit. (Spec text describes a
  single-call `{runId, publicToken}` shape that does not exist.)
- Run status → both combined: `useRealtimeRun` drives input-disabled/spinner
  lifecycle; `ai-status-feed` (`AI_STATUS`) text drives the status strip.
- Green styling → map to theme tokens (`success`), no hardcoded hex
  (ui-context.md forbids hex; spec 27's `#62C073` is expressed via tokens).
- Assistant reply → broadcast as `role: "assistant"` so every connected
  client receives it via the existing validator.

## Files to Create

```
components/ai-sidebar/status-strip.tsx  # compact active-run bar above input
.claude/plans/27-design-agent-frontend.md  # this plan
```

## Files to Modify

1. `hooks/use-ai-chat-feed.ts` — add `sendAssistant(content)` (role
   assistant, sender `{id: "ghost", name: "Ghost"}`, optimistic-append +
   broadcast, same try/catch + `sendError` pattern).
2. `hooks/use-design-agent.ts` — after a successful trigger POST, capture
   `runId`, fetch the token via `POST /api/ai/design/token`, store both;
   add unconditional `useRealtimeRun(runId ?? undefined, {accessToken:
publicToken ?? undefined, enabled: !!runId && !!publicToken,
skipColumns: ["payload","output"]})`; derive
   `isRunning = aiStatusActive || realtimeActive`; expose
   `{stage, lastMessage, isActive, runId, start, reset}`. **Stale-cache
   guard (live-test fix):** `useRealtimeRun` caches the last-seen run per
   hook instance, so `realtimeStatus` is gated on
   `subscribed = runId !== null && publicToken !== null` and reads as
   `undefined` otherwise — without this, a terminal `AI_STATUS` clears the
   credentials (unsubscribing before `COMPLETED` arrives) and a cached
   `EXECUTING` latches `isActive` on forever.
3. `components/ai-sidebar/tabs.tsx` — `handleSend`: chat-send user message
   first, then `designStart`; abort backend call if chat send fails.
   `onTerminal(message, ok, runId)`: terminal run messages post as Ghost
   through `POST /api/ai/chat/assistant` (spec 28, server-origin only);
   requester-local failures (`runId` null) append locally without broadcast.
   Render `<StatusStrip>` only when active; pass `disabled` + `isRunning`
   into `ChatInput`. `projectId`/`roomId` props now actually used.
4. `components/ai-sidebar/chat-input.tsx` — accept `isRunning?`; disable
   textarea + spinner send button while running.
5. `components/ai-sidebar/chat-message.tsx` — user bubble to
   `border-success/40 bg-success/10` (token-mapped green intent, contrast
   kept via primary text); assistant annotation unchanged.
6. `.claude/context/progress-tracker.md` — record implementation state.

No `trigger/`, `app/api/`, `Storage`, `Presence`, or canvas-file changes.
No new dependencies.

## Design

### Assistant append (`use-ai-chat-feed.ts` + `POST /api/ai/chat/assistant`)

```ts
sendAssistant: (runId: string | null, content: string) => Promise<boolean>;
```

Spec 28: no client broadcasts as Ghost. With a `runId`, the hook POSTs to
the ownership-gated server route, which verifies TaskRun ownership and
broadcasts from server origin; the hook appends with the returned id (echo
dedupes). With null `runId` (or a failed POST), it appends locally only.
Listener (all clients): assistant renders only from server origin with the
Ghost sender id; user messages render only when `sender.id` matches the
connection `user.id`. `send()` fails fast on blank/ghost/`anonymous` ids.
`sendError` pattern unchanged (small inline message, never sidebar-wide).

### Run lifecycle (`use-design-agent.ts`)

- `start(prompt)`: trim-guard → `setStage("working")`, optimistic status →
  `POST /api/ai/design {prompt, projectId, roomId}` → non-OK maps to error
  - `onTerminal(message, false)` + return false → on `{runId}`, `POST
/api/ai/design/token {runId}` → non-OK maps the same way (run id kept
    for debugging but realtime never subscribes without a token) → store
    both, return true. Progress from here arrives via `AI_STATUS`
    broadcasts; completion/error also arrives via realtime as a backstop.
- `useRealtimeRun` terminal mapping (enum values verified against the
  pinned SDK docs before coding): `COMPLETED` → if no `AI_STATUS`
  terminal arrived, reset + surface fallback message via `onTerminal`;
  `FAILED`/`CANCELED`/`CRASHED`-class → same with error text. Non-terminal
  (`QUEUED`/`EXECUTING`/`DELAYED`-class) → `realtimeActive = true`.
- `isActive = aiStatusActive || realtimeActive`. `reset()` clears
  `runId`/`publicToken` (called after terminal handling so a fresh prompt
  starts clean).

### Sidebar wiring (`tabs.tsx`)

- Sender from Clerk `useUser()` (unchanged fallback chain), bound at render
  to the Liveblocks connection id (spec 28 — forged ids dropped).
- `handleSend` returns boolean straight to `ChatInput` (existing clear-
  only-on-success contract preserved).
- Errors: terminal run failures post as Ghost via the server route so every
  collaborator sees the same state; requester-local failures (trigger
  4xx/5xx, token 403/404, realtime terminal failure without a run, network)
  append locally for the requester only — per spec 28 no client broadcasts
  as Ghost.

### Status strip (`status-strip.tsx`)

Compact bar above the input, rendered only during active runs. Dark base
(`bg-base`, `border-surface-border`), `text-success` indicator dot/spinner

- `text-copy-secondary` truncated status text (`truncate`,
  `aria-live="polite"`), subtle pulse with `motion-reduce` guard.

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt:check` (touched files)
  → `build`.
- Static: empty prompt no-op; token failure → `ai-chat` error + re-enabled
  input; no realtime subscribe before `runId`+token (`enabled` guard);
  malformed events ignored; duplicate ids deduped.
- Live two-client matrix (needs `TRIGGER_SECRET_KEY`,
  `LIVEBLOCKS_SECRET_KEY`, `trigger dev`): A submits → user message +
  strip + disabled input on A and B; canvas updates on both via
  `useLiveblocksFlow`; completion → assistant message on both, strip
  clears, inputs re-enable; backend-down → error message, canvas intact.

## Risks

- **Token is triggerer-scoped** (plan 23 gate). Collaborators'
  `useRealtimeRun` 403s — they still see chat + strip + canvas via
  Liveblocks. Needs a backend scope change to fix (out of scope).
- **Ephemeral chat.** Refresh/late-join sees empty history (inherited
  RoomEvent tradeoff from spec 26). "Across sessions" means connected
  sessions.
- **Realtime status enum.** Exact `run.status` strings confirmed against
  the pinned SDK docs at implementation time (step zero).
