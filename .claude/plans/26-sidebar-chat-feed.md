# Plan: 26 Sidebar Chat Feed — Collaborative `ai-chat` on RoomEvent

## Context

Spec `.claude/context/specs/26-sidebar-chat-feed.md` adds real-time room chat
to the AI sidebar on a separate Liveblocks `ai-chat` feed. Chat only: no AI
replies, no backend task triggers, no mixing with `ai-status-feed`, no
parallel realtime system outside Liveblocks.

**What already exists (do not rebuild):**

- `liveblocks.config.ts` — `Presence { cursor, isThinking }`, `RoomEvent`
  `{ type: "AI_STATUS"; runId; stage; message }`, broadcast via
  `liveblocks.broadcastEvent` from `trigger/design-agent.ts`, received via
  `useEventListener` — room-wide, ephemeral, no history.
- `components/ai-sidebar/` — `tabs.tsx` (local message state + design-agent
  send), `chat-area.tsx`, `chat-message.tsx` (no sender/timestamp),
  `chat-input.tsx` (clears unconditionally, `onSend` returns void),
  `constants.ts` (local `ChatMessage { id, role, content }`).
- Sidebar already renders inside `RoomProvider` via the `CanvasRoom` children
  slot (`app/editor/[roomId]/editor-workspace-client.tsx`), so
  `useBroadcastEvent` / `useEventListener` resolve with no layout change.

**Approved decisions (user answered clarifying questions):**

- Transport → ephemeral `AI_CHAT` RoomEvent, same pattern as `AI_STATUS`
  (late joiners see no history — accepted tradeoff; a Storage-backed history
  is a follow-up, not this spec).
- Send path → pure chat only: sidebar sends broadcast to `ai-chat` and never
  trigger background tasks.
- Validation → hand-rolled `isAiChatFeedPayload` in `types/tasks.ts`
  (consistent with `lib/api/validation.ts`; no Zod dependency).

## Files to Create

```
types/tasks.ts            # AI_CHAT_FEED + AiChatFeedPayload + validator (client+server safe, no @/ imports)
hooks/use-ai-chat-feed.ts # useAiChatFeed(): ordered validated subscription + broadcast send + sendError
.claude/plans/26-sidebar-chat-feed.md  # this plan
```

## Files to Modify

1. `liveblocks.config.ts` — extend `RoomEvent` union with the `AI_CHAT`
   variant; comment documents `ai-chat` (chat) vs `ai-status-feed` /
   `AI_STATUS` (progress). No `Storage`/`Presence` change.
2. `components/ai-sidebar/constants.ts` — drop the local `ChatMessage`
   shape; re-export `AiChatFeedPayload` as `ChatMessage` so all sidebar
   imports share the single validated shape.
3. `components/ai-sidebar/tabs.tsx` — replace local message state with the
   feed hook; `handleSend` builds the sender from Clerk `useUser()` and
   broadcasts; remove the `useDesignAgent.start()` call. `projectId`/`roomId`
   stay on the props (voided) so a later spec can re-attach AI triggering
   without changing the public API.
4. `components/ai-sidebar/chat-area.tsx` — no logic change (already takes
   `ChatMessage[]`, now the feed payload type).
5. `components/ai-sidebar/chat-message.tsx` — render sender + timestamp micro
   line on both variants (`toLocaleTimeString` hour/minute); keep the
   cream-bubble / schematic-annotation styling.
6. `components/ai-sidebar/chat-input.tsx` — `onSend` returns `boolean`;
   clear only on success; render a small `role="alert"` error line from
   `sendError`. Enter/Shift+Enter, IME guard, auto-resize untouched.
7. `.claude/context/progress-tracker.md` — record implementation state.

No `trigger/`, `app/api/`, `Storage`, or `Presence` changes. No new deps.

## Design

### Feed schema (`types/tasks.ts`)

```ts
export const AI_CHAT_FEED = "ai-chat" as const;
export type AiChatRole = "user" | "assistant"; // only "user" sent in this spec; "assistant" reserved
export type AiChatSender = { id: string; name: string };
export type AiChatFeedPayload = {
  id: string;
  sender: AiChatSender;
  role: AiChatRole;
  content: string;
  timestamp: number;
};
export function isAiChatFeedPayload(v: unknown): v is AiChatFeedPayload;
```

Hand-rolled `asRecord` checks: `id`/sender fields non-empty, `role`
allow-list, `content` trimmed 1–2000 chars, `timestamp` finite number.
Invalid → caller keeps previous state, never renders unvalidated content.
Shaped so plan 25's `AI_STATUS_FEED` section can sit alongside without
conflict.

### Feed hook (`hooks/use-ai-chat-feed.ts`)

- `useState<AiChatFeedPayload[]>` — ordered session history, append-only.
- `useEventListener(({ event }) => { if (event.type !== "AI_CHAT") return;
if (!isAiChatFeedPayload(event)) return; setMessages(prev => dedupe by id) })`.
- `useBroadcastEvent()` returns `(event, options?) => void` (sync, verified
  against `@liveblocks/react` dist types) — `send` wraps it in try/catch and
  returns `boolean`. Optimistic append before broadcast; the echo (if the
  room relays back to the sender) is absorbed by the id dedupe.
- `sendError` state: over-long message or broadcast throw. Small inline
  message only — never a sidebar-wide block.
- Must render inside `RoomProvider` (true via `CanvasRoom` children slot).

### Sidebar wiring

- `tabs.tsx`: sender from `useUser()` —
  `fullName ?? username ?? primaryEmail ?? firstEmail ?? "Someone"`,
  id `user?.id ?? "anonymous"`. `handleSend` returns the `send()` boolean
  straight to `ChatInput`.
- `chat-input.tsx`: `submit()` calls `onSend`, clears + resizes only when it
  returns `true`; failed sends keep the draft and show `sendError`.
- `chat-message.tsx`: `meta = sender.name + (time ? " · " + time : "")` in
  `font-mono text-[11px] text-copy-faint` — right-aligned above user bubbles,
  under the "Ghost" eyebrow for assistant messages.

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt:check` (touched files) → `build`.
- Static: malformed event (bad role, empty/over-long content, missing sender,
  non-numeric timestamp) ignored; duplicate `id` appended once; failed
  broadcast keeps the draft + shows the error.
- Live two-client matrix (no backend needed): A sends → appears on A + B in
  order with sender + time; B sends → appears on both; input clears only on
  success; `AI_STATUS` traffic never appears in chat and vice versa.

## Risks

- **Ephemeral history.** Refresh / late join = empty chat. Accepted per the
  transport decision; Storage history is a future spec.
- **Design trigger unwired.** The sidebar no longer starts AI runs and
  `useDesignAgent` is temporarily unused by it (file kept; the canvas
  overlay has its own listener). A later spec must re-attach triggering
  (e.g. `/design` command or AI-reply spec).
- **Client-asserted sender.** No server check on RoomEvents — fine for
  member-gated collab chat, not a trust boundary.
