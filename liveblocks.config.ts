// Liveblocks types for the application.
// https://liveblocks.io/docs/api-reference/liveblocks-react#Typing-your-data
//
import type { LiveObject } from "@liveblocks/client";

// Only the shapes that the realtime collaboration surface needs today are
// defined: `Presence` for cursor + thinking indicator, `UserMeta` for the
// per-user metadata attached to session tokens in /api/liveblocks-auth.
// `RoomEvent` carries the design agent status feed (spec 24).
// `Storage.aiStatus` persists the latest status for late-joiner replay
// (spec 25 fix: ephemeral `AI_STATUS` events never reach collaborators who
// join mid-run, so the task also writes the same payload to Storage).
// `ThreadMetadata` and `RoomInfo` are left as `{}` and will
// be filled in by their owning specs.
//
// `Storage` is intentionally left as `{}` here. The canvas graph itself is
// owned by `@liveblocks/react-flow`'s `useLiveblocksFlow` hook, which writes
// to its own `flow` LiveObject under the default `storageKey: "flow"`. The
// hook is generic over the node/edge shape, so the canvas room and the
// drop hook pass their concrete `CanvasNode` / `CanvasEdge` types at the
// call site. The canvas drop hook reads the `flow` LiveObject via a local
// `LiveblocksFlow<CanvasNode, CanvasEdge>` cast — see `hooks/use-canvas-drop.ts`.

declare global {
  interface Liveblocks {
    // Each user's Presence, for useMyPresence, useOthers, etc.
    Presence: {
      // `null` when the cursor leaves the canvas — lets a renderer show a
      // "left the canvas" indicator without a sentinel coordinate.
      cursor: { x: number; y: number } | null;
      isThinking: boolean;
    };

    // The Storage tree for the room, for useMutation, useStorage, etc.
    //
    // `aiStatus` is the replayable copy of the latest `AI_STATUS` feed message
    // (spec 25). The canvas graph is owned by
    // `@liveblocks/react-flow`'s `useLiveblocksFlow` hook, which stores its
    // own `flow` LiveObject at runtime (untyped here, reached via local cast).
    // `aiStatus` is created lazily by the design-agent task (or the first
    // client mutation) when missing — same wins-first pattern as `flow` — so
    // readers must treat it as possibly absent until the first run.
    Storage: {
      aiStatus: LiveObject<{
        runId: string;
        stage: "start" | "processing" | "complete" | "error";
        message: string;
        updatedAt: number;
      }>;
    };

    // Custom user info set when authenticating with a secret key
    UserMeta: {
      id: string;
      info: {
        name: string;
        avatar: string;
        color: string;
      };
    };

    // Custom events, for useBroadcastEvent, useEventListener
    //
    // `AI_STATUS` is the design agent's shared status feed (spec 24, logical
    // name `ai-status-feed`). The `design-agent` Trigger.dev task broadcasts
    // these via `liveblocks.broadcastEvent(roomId, …)` (no websocket needed)
    // AND persists the same payload to `Storage.aiStatus` (spec 25 replay
    // fix). Every connected client receives broadcasts through
    // `useEventListener`; collaborators who join mid-run hydrate from Storage
    // instead — so progress is visible to all collaborators, not just the
    // requester or those connected at broadcast time.
    // Terminal stages stay sticky in Storage until the next run.
    //
    // `AI_CHAT` is the collaborative sidebar chat feed (spec 26, logical name
    // `ai-chat`). Clients broadcast user messages via `useBroadcastEvent`
    // from the AI sidebar and receive them via `useEventListener`.
    // Auth model (spec 28): client-provided sender fields are never
    // authoritative. `role: "user"` renders only when `sender.id` matches
    // the connection `user.id` (every session is identified with the Clerk
    // user id in `/api/liveblocks-auth`, so members cannot impersonate each
    // other); `role: "assistant"` renders only from server origin
    // (`POST /api/ai/chat/assistant`, TaskRun-ownership-gated) with the
    // Ghost sender id. Room-scoped and ephemeral like `AI_STATUS`, but a
    // separate channel: status updates must never render as chat messages
    // and chat messages must never drive AI activity indicators.
    RoomEvent:
      | {
          type: "AI_STATUS";
          runId: string;
          stage: "start" | "processing" | "complete" | "error";
          message: string;
        }
      | {
          type: "AI_CHAT";
          id: string;
          sender: { id: string; name: string };
          role: "user" | "assistant";
          content: string;
          timestamp: number;
        };

    // Custom metadata set on threads, for useThreads, useCreateThread, etc.
    ThreadMetadata: {};

    // Custom room info set with resolveRoomsInfo, for useRoomInfo
    RoomInfo: {};
  }
}

// Re-export to keep this file a module — `declare global` only fires inside
// a module context, and a non-empty export side-steps the
// `unicorn/require-module-specifiers` lint rule that would otherwise flag
// `export {};`.
export type LiveblocksConfig = Liveblocks;
