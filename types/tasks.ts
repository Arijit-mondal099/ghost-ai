// ---------------------------------------------------------------------------
// Shared task-feed payload types (specs 25 + 26).
//
// `AI_STATUS_FEED` (`ai-status-feed`, spec 25) is the logical name for the
// shared AI activity channel. Transport is dual: the ephemeral `AI_STATUS`
// RoomEvent for low-latency fanout to connected clients, plus the persisted
// `aiStatus` Storage LiveObject for late-joiner replay (a collaborator who
// joins mid-run reads Storage on mount — RoomEvents alone never reach them).
// Both shapes are validated by `isAiStatusFeedPayload` before rendering.
//
// `AI_CHAT_FEED` (spec 26) stays ephemeral-only (session history, late
// joiners see nothing — the accepted RoomEvent tradeoff).
// ---------------------------------------------------------------------------

export const AI_STATUS_FEED = "ai-status-feed" as const;

export const AI_STATUS_STAGES = ["start", "processing", "complete", "error"] as const;

export type AiStatusStage = (typeof AI_STATUS_STAGES)[number];

export type AiStatusFeedPayload = {
  runId: string;
  stage: AiStatusStage;
  message: string;
  /** Storage-only recency marker; absent on wire RoomEvents. */
  updatedAt?: number;
};

export function isAiStatusFeedPayload(value: unknown): value is AiStatusFeedPayload {
  const record = asRecord(value);
  if (!record) return false;
  if (!isNonEmptyString(record["runId"])) return false;
  if (typeof record["stage"] !== "string") return false;
  if (!(AI_STATUS_STAGES as readonly string[]).includes(record["stage"])) return false;
  if (typeof record["message"] !== "string") return false;
  if (
    record["updatedAt"] !== undefined &&
    (typeof record["updatedAt"] !== "number" || !Number.isFinite(record["updatedAt"]))
  )
    return false;
  return true;
}

export const AI_CHAT_FEED = "ai-chat" as const;

export const AI_CHAT_ROLES = ["user", "assistant"] as const;

/** Fixed sender id for Ghost assistant messages (spec 28). Clerk ids look
  like `user_*`, so a real user can never collide with this. */
export const AI_CHAT_GHOST_SENDER_ID = "ghost" as const;

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
  // Role/sender binding (spec 28): assistant messages may only come from
  // Ghost, and no user message may claim the Ghost id. Origin (connection
  // identity vs server broadcast) is enforced by the listener.
  if (record["role"] === "assistant" && sender["id"] !== AI_CHAT_GHOST_SENDER_ID) return false;
  if (
    record["role"] === "user" &&
    (sender["id"] === AI_CHAT_GHOST_SENDER_ID || sender["id"] === "anonymous")
  )
    return false;
  if (typeof record["content"] !== "string") return false;
  const content = record["content"].trim();
  if (content.length === 0 || content.length > AI_CHAT_CONTENT_MAX_LENGTH) return false;
  if (typeof record["timestamp"] !== "number" || !Number.isFinite(record["timestamp"]))
    return false;
  return true;
}
