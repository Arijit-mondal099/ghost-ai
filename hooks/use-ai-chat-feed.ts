"use client";

import { useCallback, useState } from "react";
import { useBroadcastEvent, useEventListener } from "@liveblocks/react";

import {
  AI_CHAT_CONTENT_MAX_LENGTH,
  AI_CHAT_GHOST_SENDER_ID,
  isAiChatFeedPayload,
  type AiChatFeedPayload,
  type AiChatSender,
} from "@/types/tasks";

// ---------------------------------------------------------------------------
// Client bridge to the collaborative sidebar chat feed (specs 26 + 28).
//
// Transport is the room-scoped ephemeral `AI_CHAT` RoomEvent (logical name
// `ai-chat`), the same broadcast pattern as the `AI_STATUS` status feed —
// but a separate channel: chat messages never drive AI activity UI and
// status events are ignored here.
//
// Sender authenticity (spec 28) comes from the connection, not the payload:
// `liveblocks-auth` identifies every session with the Clerk `userId`, so
// `role: "user"` renders only when `sender.id` matches the connection
// `user.id` (impersonating another member is impossible without forging a
// Liveblocks session), and `role: "assistant"` renders only from server
// origin (`POST /api/ai/chat/assistant`, `connectionId -1`) with the Ghost
// sender id. Client-provided identity fields are never authoritative.
//
// `messages` is the ordered session history (late joiners see nothing — the
// accepted RoomEvent tradeoff). Inbound events are validated with
// `isAiChatFeedPayload` before rendering and deduped by `id`, which also
// absorbs the sender's own optimistic echo.
//
// `send(content, sender)` appends an optimistic user message and broadcasts;
// `sendAssistant(runId, content)` posts a terminal Ghost message through the
// server route (ownership-gated by TaskRun) and appends with the returned
// id; a null `runId` (requester-local failure with no run) or a failed POST
// appends locally only, so the requester still sees terminal state without
// letting any client speak as Ghost. Both return success booleans (`send`
// synchronously, `sendAssistant` as a promise); failures render `sendError`
// (a small inline message, not a sidebar-wide block).
//
// Must render inside `<RoomProvider>` (the AI sidebar does, via the
// `CanvasRoom` children slot).
// ---------------------------------------------------------------------------

// Single choke point for every insertion (listener, optimistic append,
// server-id append, local fallback): a duplicate `id` is never correct, so
// re-insertion is a no-op. This makes same-key renders structurally
// impossible even if an event is delivered twice (stale dev subscription,
// hot-reload artifact) or two appends race.
function insertUnique(prev: AiChatFeedPayload[], payload: AiChatFeedPayload): AiChatFeedPayload[] {
  return prev.some((message) => message.id === payload.id) ? prev : [...prev, payload];
}

function useAiChatFeed(): {
  messages: AiChatFeedPayload[];
  sendError: string | null;
  send: (content: string, sender: AiChatSender) => boolean;
  sendAssistant: (runId: string | null, content: string) => Promise<boolean>;
} {
  const [messages, setMessages] = useState<AiChatFeedPayload[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const broadcast = useBroadcastEvent();

  useEventListener(({ event, connectionId, user }) => {
    if (event.type !== "AI_CHAT") return;
    if (!isAiChatFeedPayload(event)) return;
    if (event.role === "assistant") {
      // Server path only: forged client Ghost messages never render.
      if (connectionId !== -1 || user !== null) return;
      if (event.sender.id !== AI_CHAT_GHOST_SENDER_ID) return;
    } else {
      // Sender must be the connection owner: forged member ids never render.
      // (No `"anonymous"` fallback — room members are always authenticated.)
      if (user === null || event.sender.id !== user.id) return;
    }
    const payload: AiChatFeedPayload = {
      id: event.id,
      sender: { id: event.sender.id, name: event.sender.name },
      role: event.role,
      content: event.content,
      timestamp: event.timestamp,
    };
    setMessages((prev) => insertUnique(prev, payload));
  });

  const appendAndBroadcast = useCallback(
    (payload: AiChatFeedPayload): boolean => {
      // Optimistic append first so the sender sees no lag; the broadcast
      // echo (if the room relays it back) is deduped by `id` above.
      setMessages((prev) => insertUnique(prev, payload));
      try {
        broadcast({ type: "AI_CHAT", ...payload });
      } catch {
        // Roll back the optimistic append: the message was never sent, so it
        // must not linger in history as if it had been.
        setMessages((prev) => prev.filter((message) => message.id !== payload.id));
        setSendError("Could not send — check your connection and try again.");
        return false;
      }
      setSendError(null);
      return true;
    },
    [broadcast],
  );

  const send = useCallback(
    (content: string, sender: AiChatSender): boolean => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      if (trimmed.length > AI_CHAT_CONTENT_MAX_LENGTH) {
        setSendError(`Message is too long (max ${AI_CHAT_CONTENT_MAX_LENGTH} characters).`);
        return false;
      }
      const senderId = sender.id.trim();
      // Never send under a blank, placeholder, or Ghost id: the listener
      // drops such messages everywhere (including our own echo), which
      // would silently blackhole them. Fail fast instead.
      if (
        senderId.length === 0 ||
        senderId === "anonymous" ||
        senderId === AI_CHAT_GHOST_SENDER_ID
      ) {
        setSendError("Could not send — check your connection and try again.");
        return false;
      }
      return appendAndBroadcast({
        id: crypto.randomUUID(),
        sender: { id: senderId, name: sender.name.trim() || "Someone" },
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      });
    },
    [appendAndBroadcast],
  );

  const appendLocalAssistant = useCallback((content: string): void => {
    // Local-only Ghost message: rendered for the requester alone (used when
    // there is no run to authorize a server broadcast, or the POST fails).
    // Shape still passes the validator for consistent rendering.
    const payload: AiChatFeedPayload = {
      id: crypto.randomUUID(),
      sender: { id: AI_CHAT_GHOST_SENDER_ID, name: "Ghost" },
      role: "assistant",
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => insertUnique(prev, payload));
  }, []);

  const sendAssistant = useCallback(
    async (runId: string | null, content: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      if (trimmed.length > AI_CHAT_CONTENT_MAX_LENGTH) {
        setSendError(`Message is too long (max ${AI_CHAT_CONTENT_MAX_LENGTH} characters).`);
        return false;
      }
      if (runId === null) {
        appendLocalAssistant(trimmed);
        return true;
      }
      try {
        const response = await fetch("/api/ai/chat/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, message: trimmed }),
        });
        if (!response.ok) throw new Error(`assistant broadcast failed (${response.status})`);
        const body: unknown = await response.json();
        const id = typeof body === "object" && body !== null ? (body as { id?: unknown }).id : null;
        if (typeof id !== "string" || id.trim().length === 0) {
          throw new Error("assistant broadcast returned no id");
        }
        // Append with the server id so the broadcast echo dedupes by `id`.
        const payload: AiChatFeedPayload = {
          id,
          sender: { id: AI_CHAT_GHOST_SENDER_ID, name: "Ghost" },
          role: "assistant",
          content: trimmed,
          timestamp: Date.now(),
        };
        setMessages((prev) => insertUnique(prev, payload));
        setSendError(null);
        return true;
      } catch {
        appendLocalAssistant(trimmed);
        return true;
      }
    },
    [appendLocalAssistant],
  );

  return { messages, sendError, send, sendAssistant };
}

export { useAiChatFeed };
