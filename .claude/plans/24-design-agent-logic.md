# Plan: 24 Design Agent Logic — Groq Interpretation, Server Canvas Writes, RoomEvent Status Feed

## Context

Spec `.claude/context/specs/24-design-agent-logic.md` upgrades the spec-23 stub
(`trigger/design-agent.ts` echo) to the full agent. Spec 23 wiring (trigger route,
TaskRun, token route) is untouched.

**Verified SDK surface (installed versions, not docs memory):**

- `@liveblocks/node`: `broadcastEvent(roomId, message)` (no websocket needed,
  `connectionId -1` on receipt), `mutateStorage(roomId, ({ root }) => …)` with
  server-side `LiveObject`/`LiveMap` re-exported from `@liveblocks/core`.
- `@liveblocks/react`: `useEventListener` (non-suspense — usable in the sidebar
  children slot, which sits inside `RoomProvider` but outside `ClientSideSuspense`).
- `groq-sdk`: `client.chat.completions.create` with a JSON-only system prompt
  (no `response_format` — Qwen on Groq rejects JSON mode); `extractOpsJson`
  recovers the payload from fences/chatter with up to 3 retried attempts.

**Approved decisions (user answered clarifying questions):**

- Status feed → `RoomEvent` broadcast (room-wide, all collaborators see it).
- Canvas write mode → append (never clear maps).
- AI presence → client-simulated overlay (task never fakes a Liveblocks identity;
  every client renders the overlay from `RoomEvent`s, so it is still shared).

## Files to Create

```
hooks/use-design-agent.ts                        # trigger POST + AI_STATUS listener + { status, isActive }
components/editor/canvas/ai-presence-overlay.tsx # fake AI cursor + thinking badge
```

## Files to Modify

1. `liveblocks.config.ts` — `RoomEvent` union (`AI_STATUS`, stages
   `start|processing|complete|error`, `{ runId, message }`).
2. `trigger/design-agent.ts` — full agent logic (only server file touched).
3. `components/editor/canvas/canvas-room.tsx` — mount `<AiPresenceOverlay />`
   in `CanvasSurface` (one line + import; no other canvas changes).
4. `components/ai-sidebar/tabs.tsx` — `handleSend`/`handleStarterSelect` trigger
   runs via the hook; assistant messages appended from events.
5. `.claude/context/progress-tracker.md` — record implementation state.

No route, validator, schema, `Storage`, or `Presence` changes. No new deps
(`groq-sdk`, `@liveblocks/node` already installed).

## Design

### RoomEvent (`liveblocks.config.ts`)

```ts
RoomEvent:
  | { type: "AI_STATUS"; runId: string; stage: "start" | "processing" | "complete" | "error"; message: string };
```

Ephemeral broadcast — not storage, so the "no new state system" invariant holds.

### Task (`trigger/design-agent.ts`)

1. Validate payload (`prompt` 1–4000 chars, non-empty `roomId`/`projectId`);
   broadcast `start`; any failure broadcasts `error` and returns `{ ok: false }`.
2. Read current canvas via `getStorageDocument(roomId, "json")` (labels/positions
   only) so the model extends rather than duplicates. Requires
   `LIVEBLOCKS_SECRET_KEY` in the Trigger environment.
3. Groq (`groq-sdk`, `qwen/qwen3.6-27b`, no JSON mode — JSON-only system
   prompt + `extractOpsJson` recovery with up to 3 attempts) with a
   system prompt constraining output to the 6 `NODE_SHAPES`, 8 `NODE_COLORS`,
   `SHAPES` dimensions, and spacing rules. Model returns an **op list**
   (discriminated union covering all 7 spec actions: add/move/resize/update-data/
   delete node, add/delete edge) — ops make every listed action expressible in
   append mode.
4. Validate ops server-side: allow-list shape/color (fallback neutral/rectangle),
   clamp positions to a sane bound, resolve edge endpoints by label-key
   (dangling edges dropped with a warning `processing` message, never written).
   Node IDs `ai-${Date.now()}-${counter}` — no collision with client IDs.
5. Apply via `mutateStorage` + `new LiveObject(…)` + `nodes.set` / `edges.set` /
   `.delete` — the server analogue of the client `LiveObject.from` pattern.
   If `flow` is missing (canvas never opened), the task creates it with empty
   maps first — mirroring the client's own `setInitialStorage` (same end
   state, never conflicts). Broadcast `processing` before writes, `complete`
   (op counts) after.
6. Errors (Groq, validation, Liveblocks) → `error` broadcast; canvas untouched.

### Client (`use-design-agent.ts`, overlay, sidebar)

- `useDesignAgent({ projectId, roomId })`: `POST /api/ai/design`, listens for
  `AI_STATUS` events, exposes `{ status, lastMessage, isActive, start(prompt) }`.
  Must render inside `RoomProvider` (both consumers already are).
- Overlay: fixed-position AI cursor + "Ghost is designing…" badge, `isActive`
  only. Display-only, `pointer-events-none`, indigo AI tokens.
- Sidebar: sent prompt → `start(prompt)`; assistant message appended on
  `complete`/`error` (all clients see it via broadcast).

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt:check` (touched files) →
  `build`.
- Live (needs `trigger dev` + keys): two-client matrix — prompt on A →
  nodes/edges on both, status on both, overlay shows then clears, bad prompt
  leaves canvas intact.

## Risks

- `qwen/qwen3.6-27b` availability — fail loudly via `error` broadcast if Groq
  rejects the model id.
- Server `LiveObject` nesting (position/data sub-objects) must round-trip
  through `useLiveblocksFlow` — verified live, not statically.
- `getStorageDocument` on a never-opened room returns empty — treated as empty
  canvas, not an error.
