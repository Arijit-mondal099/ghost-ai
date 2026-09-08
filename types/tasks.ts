// ---------------------------------------------------------------------------
// Shared task-feed payload types (spec 26 — sidebar chat feed).
//
// `AI_CHAT_FEED` is the logical name for the room-scoped collaborative chat
// channel. The transport is the `AI_CHAT` Liveblocks RoomEvent (ephemeral
// broadcast, same pattern as the `AI_STATUS` status feed) — never persisted
// to Storage. This file is client+server safe: no `@/` imports.
//
// Validation is hand-rolled (consistent with `lib/api/validation.ts`; the
// project has no Zod dependency): `isAiChatFeedPayload` guards every inbound
// event before it is rendered. Invalid payloads are dropped by the caller,
// which keeps its previous message list.
// ---------------------------------------------------------------------------

export const AI_CHAT_FEED = "ai-chat" as const;

export const AI_CHAT_ROLES = ["user", "assistant"] as const;

export type AiChatRole = (typeof AI_CHAT_ROLES)[number];

export type AiChatSender = {
  id: string;
  name: string;
};

export type AiChatFeedPayload = {
  id: string;
  sender: AiChatSender;
  role: AiChatRole;
  content: string;
  /** `Date.now()` milliseconds at send time. */
  timestamp: number;
};

export const AI_CHAT_CONTENT_MAX_LENGTH = 2000;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isAiChatFeedPayload(value: unknown): value is AiChatFeedPayload {
  const record = asRecord(value);
  if (!record) return false;
  if (typeof record["id"] !== "string" || record["id"].trim().length === 0) return false;
  const sender = asRecord(record["sender"]);
  if (!sender) return false;
  if (!isNonEmptyString(sender["id"])) return false;
  if (!isNonEmptyString(sender["name"])) return false;
  if (typeof record["role"] !== "string") return false;
  if (!(AI_CHAT_ROLES as readonly string[]).includes(record["role"])) return false;
  if (typeof record["content"] !== "string") return false;
  const content = record["content"].trim();
  if (content.length === 0 || content.length > AI_CHAT_CONTENT_MAX_LENGTH) return false;
  if (typeof record["timestamp"] !== "number" || !Number.isFinite(record["timestamp"]))
    return false;
  return true;
}
