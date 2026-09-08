Authenticate AI sidebar chat so room members cannot spoof other senders or Ghost.

## Problem

`AI_CHAT` RoomEvents carry client-provided `sender` and `role`. Any room
member can broadcast another collaborator's id or `role: "assistant"`.
Structural validation (`isAiChatFeedPayload`) cannot establish origin.

## Implementation

1. Bind user messages to the Liveblocks connection identity.
   - `liveblocks-auth` identifies sessions with the Clerk `userId`, so the
     `user` object in `useEventListener` is server-authenticated.
   - The `AI_CHAT` listener accepts `role: "user"` only when
     `event.sender.id` equals the connection `user.id`. All other user-role
     messages are dropped (including the dead `"anonymous"` fallback).
   - Client-provided `sender.id` is never authoritative; display `name`
     stays payload-provided (self-labeling only, cosmetic).

2. Restrict `role: "assistant"` to the server path.
   - The listener accepts assistant messages only with server origin
     (`connectionId === -1`, `user === null`) and `sender.id === "ghost"`.
   - New `POST /api/ai/chat/assistant` (`{ runId, message }`): Clerk auth →
     TaskRun lookup (404 on miss) → `userId` ownership check (403) →
     project-access recheck (404) → server `broadcastEvent` to the TaskRun's
     project room (room id server-derived, never caller-provided) with a
     server-generated message id → `201 { id }`.
   - The initiator posts terminal run messages through this route and appends
     with the returned id (dedupes the server echo). Requester-local failures
     with no run (trigger/token/network errors) append locally only and are
     visible to the requester alone.

3. Structural hardening in `types/tasks.ts`.
   - `role: "assistant"` requires `sender.id === "ghost"`; `role: "user"`
     rejects `"ghost"`/`"anonymous"` ids. Malformed shapes never render.

## Scope Limits

- No change to user-message UX (still optimistic client broadcast + sync send).
- No change to canvas, presence, `AI_STATUS`, or token flows.
- No server user-message path (out of scope; id-binding already prevents
  impersonation without forging a Liveblocks session).

## Check When Done

- A forged user message with another member's id does not render.
- A client-broadcast assistant message does not render.
- Own-run completion still posts one Ghost message visible on all clients.
- `bun run build` passes.
