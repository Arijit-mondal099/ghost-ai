# Plan: 28 Chat Auth — Bind Senders to Connection Identity, Server-Only Assistant

## Context

Spec `.claude/context/specs/28-chat-auth.md`. `liveblocks-auth` identifies
every session with the Clerk `userId` (`identifyUser({ userId })`), so the
`user` in `useEventListener(({ event, user, connectionId }))` is
server-authenticated. No new deps, no Storage/Presence changes.

## Files to Create

```text
app/api/ai/chat/assistant/route.ts  # ownership-gated assistant broadcast
```

## Files to Modify

1. `types/tasks.ts` — `AI_CHAT_GHOST_SENDER_ID = "ghost"` const; validator:
   assistant requires ghost sender id, user rejects ghost/`"anonymous"` ids.
2. `lib/api/validation.ts` — `parseAssistantMessageBody` (`{ runId, message
1–2000 }`, reuses `AI_CHAT_CONTENT_MAX_LENGTH`).
3. `hooks/use-ai-chat-feed.ts` — listener: user role requires
   `event.sender.id === user?.id`, assistant requires server origin +
   ghost id; `send()` rejects blank/ghost/`anonymous` ids; `sendAssistant`
   becomes async server post with local-only fallback (signature:
   `(runId: string | null, content: string) => Promise<boolean>`).
4. `hooks/use-design-agent.ts` — `onTerminal` gains `runId: string | null`
   (local errors pass null, own-run terminals pass the run id).
5. `components/ai-sidebar/tabs.tsx` — `onTerminal` posts through
   `sendAssistant(runId, message)` (fire-and-forget).
6. `liveblocks.config.ts` — comment documents the auth model.
7. Specs 26/27 Check-When-Done + plan 27 sidebar-wiring notes — local-only
   error visibility.
8. `.claude/context/progress-tracker.md` — record.

## Design

- Assistant route mirrors the token route gates (TaskRun 404 → owner 403 →
  project recheck 404), broadcasts via the cached node client to
  `taskRun.projectId`, id from `crypto.randomUUID()`, `201 { id }`, 502 on
  broadcast failure. Reuses `requireUserId`, `badRequest/forbidden/notFound`,
  `json` helpers.
- Initiator appends with the server id (echo dedupes); POST failure appends
  locally so the requester still sees terminal state.
- `useEventListener` destructures `{ event, user, connectionId }` (verified
  against installed `@liveblocks/react` + core `RoomEventMessage` types:
  server broadcasts arrive `connectionId -1` / `user null`).

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt` → `build`.
- Static: forged sender id dropped; client assistant dropped; anonymous
  send rejected; validator unit shapes (ghost/user cross-rejections).
- Live two-client: A completes → one Ghost message on both; B forges
  assistant → renders nowhere; B forges A's id → renders nowhere.

## Risks

- Behavior change: requester-local failures (trigger/token/network) no
  longer broadcast room-wide — visible to the requester only. Terminal run
  messages still reach everyone via the server route.
- Assistant append is no longer instant-optimistic (id comes from the
  server); terminal-only path, negligible UX impact.
