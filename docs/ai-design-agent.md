# AI Design Agent

Generates system-design nodes/edges from a natural-language prompt into the shared Liveblocks room. Runs as a durable Trigger.dev task — API routes only trigger, never generate.

## Trigger

- `POST /api/ai/design` — body `{ prompt, roomId }` (validated by `parseDesignTriggerBody`). Guards: `requireUserId()` → Upstash `ai` ratelimit → project access. Triggers task `design-agent`, persists `TaskRun { runId, projectId, userId }`, returns `{ runId }`.
- `POST /api/ai/design/token` — mints a run-scoped public token (`read: { runs: [runId] }`) after TaskRun-ownership + project-access checks. Client subscribes with `@trigger.dev/react-hooks` `useRealtimeRun`.
- `POST /api/ai/chat/assistant` — server-origin Ghost `AI_CHAT` broadcast (TaskRun-gated, returns `201 { id }` for dedupe).

Client: `hooks/use-design-agent.ts` (trigger + realtime subscription) + `components/ai-sidebar/chat-input.tsx` (prompt box). Chat feed: `hooks/use-ai-chat-feed.ts` listens for `AI_CHAT` broadcasts validated by `isAiChatFeedPayload` (`types/tasks.ts`); `chat-area.tsx` / `chat-message.tsx` render user vs. Ghost bubbles (role-gated on sender id).

## Task: `design-agent` (`trigger/design-agent.ts`)

Payload `{ prompt, roomId, projectId }` → `{ ok, addedNodes, addedEdges, appliedOps, warnings } | { ok: false, error }`.

1. Broadcast `AI_STATUS start` + persist `Storage.aiStatus` (`{ runId, stage, message, updatedAt }`).
2. Snapshot room via `getStorageDocument(roomId)` (40-node cap).
3. Call Groq `qwen/qwen3.6-27b` (`reasoning_effort: none`, `max_tokens: 1000`, 3 attempts, 429 fail-fast) with a compact JSON `{ ops: [] }` contract.
4. Validate ops: shape/color allow-lists (`NODE_SHAPES`/`NODE_COLORS`), coordinate clamp ±4000, edge endpoint resolution.
5. Atomic `mutateStorage` — `LiveMap nodes/edges`, `LiveObject.from` pattern, append-only.
6. Broadcast `processing` → `complete`/`error` + Storage persist on every stage.

Caps: 50 ops, 30 nodes, 40 edges per run. `trigger.config.ts`: `maxDuration: 3600`, 3× exponential retries.

## Realtime status

- Ephemeral `AI_STATUS` RoomEvents (`{ runId, stage, message }`) for low-latency fanout.
- Persisted `aiStatus` Storage LiveObject for late-joiner replay (sentinel `runId: "init"` ignored by readers).
- `hooks/use-design-agent.ts` hydrates from `useStorage` (null-safe, skips `init`, never fires terminal callbacks on replay) with live events as fast path.
- UI: `components/ai-sidebar/status-strip.tsx` (stage banner) + `components/editor/canvas/ai-presence-overlay.tsx` (Ghost cursor) + `hooks/use-run-clock.ts` (elapsed timer).

Rate limiting: Upstash `ai` budget; `rate-limit-overlay.tsx` shows 429/quota banners.
