"use client";

import { useCallback, useState } from "react";
import { useBroadcastEvent, useEventListener } from "@liveblocks/react";

import {
  AI_CHAT_CONTENT_MAX_LENGTH,
  isAiChatFeedPayload,
  type AiChatFeedPayload,
  type AiChatSender,
} from "@/types/tasks";

// ---------------------------------------------------------------------------
// Client bridge to the collaborative sidebar chat feed (spec 26).
//
// Transport is the room-scoped ephemeral `AI_CHAT` RoomEvent (logical name
// `ai-chat`), the same broadcast pattern as the `AI_STATUS` status feed —
// but a separate channel: chat messages never drive AI activity UI and
// status events are ignored here.
//
// `messages` is the ordered session history (late joiners see nothing — the
// accepted RoomEvent tradeoff). Inbound events are validated with
// `isAiChatFeedPayload` before rendering and deduped by `id`, which also
// absorbs the sender's own optimistic echo.
//
// `send(content, sender)` appends an optimistic user message and broadcasts;
// `sendAssistant(content)` does the same with `role: "assistant"` from the
// fixed Ghost sender (spec 27: terminal run updates render as Ghost messages
// on every connected client). Both return `true` on success and `false` on
// failure (broadcast throws synchronously — verified against
// `@liveblocks/react`'s `(event, options?) => void` signature). The caller
// clears the composer only on success and renders `sendError` (a small inline
// message, not a sidebar-wide block) on failure.
//
// Must render inside `<RoomProvider>` (the AI sidebar does, via the
// `CanvasRoom` children slot).
// ---------------------------------------------------------------------------

function useAiChatFeed(): {
  messages: AiChatFeedPayload[];
  sendError: string | null;
  send: (content: string, sender: AiChatSender) => boolean;
  sendAssistant: (content: string) => boolean;
} {
  const [messages, setMessages] = useState<AiChatFeedPayload[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const broadcast = useBroadcastEvent();

  useEventListener(({ event }) => {
    if (event.type !== "AI_CHAT") return;
    if (!isAiChatFeedPayload(event)) return;
    const payload: AiChatFeedPayload = {
      id: event.id,
      sender: { id: event.sender.id, name: event.sender.name },
      role: event.role,
      content: event.content,
      timestamp: event.timestamp,
    };
    setMessages((prev) =>
      prev.some((message) => message.id === payload.id) ? prev : [...prev, payload],
    );
  });

  const appendAndBroadcast = useCallback(
    (payload: AiChatFeedPayload): boolean => {
      // Optimistic append first so the sender sees no lag; the broadcast
      // echo (if the room relays it back) is deduped by `id` above.
      setMessages((prev) => [...prev, payload]);
      try {
        broadcast({ type: "AI_CHAT", ...payload });
      } catch {
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
      return appendAndBroadcast({
        id: crypto.randomUUID(),
        sender: { id: sender.id.trim() || "anonymous", name: sender.name.trim() || "Someone" },
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      });
    },
    [appendAndBroadcast],
  );

  const sendAssistant = useCallback(
    (content: string): boolean => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      if (trimmed.length > AI_CHAT_CONTENT_MAX_LENGTH) {
        setSendError(`Message is too long (max ${AI_CHAT_CONTENT_MAX_LENGTH} characters).`);
        return false;
      }
      return appendAndBroadcast({
        id: crypto.randomUUID(),
        sender: { id: "ghost", name: "Ghost" },
        role: "assistant",
        content: trimmed,
        timestamp: Date.now(),
      });
    },
    [appendAndBroadcast],
  );

  return { messages, sendError, send, sendAssistant };
}

export { useAiChatFeed };
