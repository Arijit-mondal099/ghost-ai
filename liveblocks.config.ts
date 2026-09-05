// Liveblocks types for the application.
// https://liveblocks.io/docs/api-reference/liveblocks-react#Typing-your-data
//
// Only the shapes that the realtime collaboration surface needs today are
// defined: `Presence` for cursor + thinking indicator, `UserMeta` for the
// per-user metadata attached to session tokens in /api/liveblocks-auth.
// `RoomEvent`, `ThreadMetadata`, and `RoomInfo` are left as `{}` and will
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
    // Intentionally empty here: the canvas graph is owned by
    // `@liveblocks/react-flow`'s `useLiveblocksFlow` hook, which stores its
    // own `flow` LiveObject at runtime. The hook is generic, so consumers
    // (the canvas room and the drop hook) declare the concrete node/edge
    // shape at the call site and read `storage.get("flow")` via a local
    // type cast. A future spec that adds non-canvas Storage keys (comments,
    // history versions, etc.) will extend this interface.
    Storage: {};

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
    RoomEvent: {};

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
