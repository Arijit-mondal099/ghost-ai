"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEventListener, useStorage } from "@liveblocks/react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

import { isAiStatusFeedPayload } from "@/types/tasks";

// ---------------------------------------------------------------------------
// Client bridge to the design agent task (specs 24 + 27).
//
// `start(prompt)` POSTs to `/api/ai/design` (which triggers the background
// task and returns a run id), then mints a run-scoped public token via
// `POST /api/ai/design/token`. The token feeds `useRealtimeRun`, which
// tracks the Trigger.dev run lifecycle directly; progress text arrives as
// room-wide `AI_STATUS` RoomEvents broadcast by the task itself — so every
// connected client, not just the requester, observes the same status feed
// through this hook. The same payload is persisted to the `aiStatus` Storage
// key (spec 25 replay fix): collaborators who join mid-run miss the ephemeral
// events, so this hook hydrates display state from Storage on mount. Storage
// hydration is display-only and never fires `onTerminal` (firing it would
// rebroadcast a terminal chat message from the late joiner to everyone).
//
// `isActive` is the union of both signals: the `AI_STATUS` stage and the
// realtime run status. Realtime also acts as a backstop — if the run reaches
// a terminal status without a matching `AI_STATUS` terminal event (e.g. an
// older task version that never broadcasts), the hook resets and surfaces a
// fallback message through `onTerminal` exactly once.
//
// Terminal stages (`complete` / `error`, from either source) are surfaced
// twice: as sticky `lastMessage` state for status displays, and via the
// optional `onTerminal(message, ok, runId)` callback so chat histories can
// append exactly one assistant message per run. `runId` is the completed
// run's id, or null for requester-local failures that never started a run
// (trigger/token/network errors) — the consumer posts run terminals through
// the ownership-gated server route and appends local failures without
// broadcast (spec 28: no client may speak as Ghost). Display state follows EVERY validated room event
// (the feed is room-wide — all collaborators see the latest status), but
// requester-local state (`runId`/`publicToken`) and `onTerminal` are scoped
// to the initiating run: events whose `runId` does not match the locally
// started run update display only and never clear the subscription or
// broadcast a terminal chat message. Without this, a second user's terminal
// event would reset this client's run and emit an unrelated assistant
// message. The initiator's hook is therefore the single `onTerminal`
// producer per run; the realtime backstop below is already per-run scoped
// (it only subscribes with the local credentials), and the stage flip keeps
// the two paths mutually exclusive, so StrictMode double-effects cannot
// duplicate messages.
//
// Must render inside `<RoomProvider>` (both consumers — the AI sidebar via
// the `CanvasRoom` children slot, and the in-canvas overlay — are).
//
// Run status values come from the pinned SDK docs
// (`node_modules/@trigger.dev/sdk/docs/realtime/run-object.mdx`).
// ---------------------------------------------------------------------------

type DesignAgentStage = "idle" | "working" | "done" | "error";

type UseDesignAgentArgs = {
  projectId: string;
  roomId: string;
  onTerminal?: (message: string, ok: boolean, runId: string | null) => void;
};

// Realtime statuses that mean "still running" — everything else terminal is
// either COMPLETED (success) or a failure variant handled as an error.
const REALTIME_ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "WAITING_FOR_DEPLOY",
  "QUEUED",
  "EXECUTING",
  "REATTEMPTING",
  "FROZEN",
  "DELAYED",
]);

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = (body as { error?: { message?: unknown } }).error;
      if (typeof error?.message === "string" && error.message.trim()) return error.message;
    }
  } catch {
    // Fall through to the status fallback below.
  }
  return `Request failed (${response.status})`;
}

function readToken(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const token = (body as { token?: unknown }).token;
  return typeof token === "string" && token.trim().length > 0 ? token : null;
}

function useDesignAgent({ projectId, roomId, onTerminal }: UseDesignAgentArgs): {
  stage: DesignAgentStage;
  lastMessage: string | null;
  isActive: boolean;
  runId: string | null;
  start: (prompt: string) => Promise<boolean>;
  reset: () => void;
} {
  const [stage, setStage] = useState<DesignAgentStage>("idle");
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [statusActive, setStatusActive] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  // Ref mirror so the event listener (registered once per render cycle)
  // never compares against a stale `runId` closure.
  const runIdRef = useRef<string | null>(null);
  useEffect(() => {
    runIdRef.current = runId;
  }, [runId]);
  // Records the runId that already emitted a terminal message. A repeated
  // terminal broadcast for the same run (or a realtime terminal arriving
  // after the event path already reported) must update display only —
  // never a second `onTerminal`. Cleared when a new run starts.
  const emittedRef = useRef<string | null>(null);

  // Replay source: persisted latest status for late joiners. Regular (non-
  // suspense) hook because the sidebar renders outside `ClientSideSuspense` —
  // `null` while loading or before the first run, never suspends.
  const storedStatus = useStorage((root) => root.aiStatus);

  // Hydrate display state from Storage without firing `onTerminal`. Live
  // `AI_STATUS` events below remain the fast path and the sole `onTerminal`
  // source, so a replayed terminal stage never rebroadcasts chat. Skipped
  // while locally working: the live event path owns the active run and a
  // stale Storage snapshot must not clobber it.
  useEffect(() => {
    if (!storedStatus) return;
    if (stage === "working") return;
    const snapshot: unknown = storedStatus;
    if (!isAiStatusFeedPayload(snapshot)) return;
    // Sentinel initial value for new rooms — no run has happened yet.
    if (snapshot.runId === "init") return;
    if (snapshot.stage === "start" || snapshot.stage === "processing") {
      setStage("working");
      setStatusActive(true);
      setLastMessage(snapshot.message);
    } else if (snapshot.stage === "complete") {
      setStage("done");
      setStatusActive(false);
      setLastMessage(snapshot.message);
    } else {
      setStage("error");
      setStatusActive(false);
      setLastMessage(snapshot.message);
    }
  }, [storedStatus, stage]);

  // Status-only subscription: no payload/output over the wire (realtime
  // skill guidance). Guarded by `enabled` so nothing subscribes before the
  // trigger + token calls resolve.
  const subscribed = runId !== null && publicToken !== null;
  const { run: realtimeRun } = useRealtimeRun(runId ?? undefined, {
    accessToken: publicToken ?? undefined,
    enabled: subscribed,
    skipColumns: ["payload", "output"],
  });
  // The hook caches the last-seen run per instance: after a terminal
  // AI_STATUS clears runId/token (unsubscribing before COMPLETED is ever
  // delivered), a stale EXECUTING would otherwise latch `isActive` on
  // forever. Only trust the realtime status while subscribed.
  const realtimeStatus: string | undefined = subscribed ? realtimeRun?.status : undefined;
  const realtimeActive =
    realtimeStatus !== undefined && REALTIME_ACTIVE_STATUSES.has(realtimeStatus);
  const isActive = statusActive || realtimeActive;

  // Realtime backstop: a terminal run status without a matching AI_STATUS
  // terminal event still resets the hook and reports once. The stage guard
  // plus the emission guard make this mutually exclusive with the listener
  // path below.
  useEffect(() => {
    if (realtimeStatus === undefined) return;
    if (REALTIME_ACTIVE_STATUSES.has(realtimeStatus)) return;
    if (realtimeStatus === "COMPLETED") {
      if (stage !== "working") return;
      if (runId !== null && emittedRef.current === runId) return;
      const message = "Design applied to the canvas.";
      emittedRef.current = runId;
      setStage("done");
      setStatusActive(false);
      setLastMessage(message);
      setRunId(null);
      setPublicToken(null);
      onTerminal?.(message, true, runId);
    } else {
      if (stage !== "working") return;
      if (runId !== null && emittedRef.current === runId) return;
      const message = `Design run ended (${realtimeStatus}). Try again.`;
      emittedRef.current = runId;
      setStage("error");
      setStatusActive(false);
      setLastMessage(message);
      setRunId(null);
      setPublicToken(null);
      onTerminal?.(message, false, runId);
    }
  }, [realtimeStatus, stage, runId, onTerminal]);

  useEventListener(({ event, connectionId, user }) => {
    if (event.type !== "AI_STATUS") return;
    // Origin guard: the design-agent task is the sole legitimate producer
    // (server broadcast via REST → `connectionId -1`, `user null`). A room
    // member could otherwise spoof `start`/`processing` and disable
    // everyone's composer, or forge terminal stages for other runs.
    if (connectionId !== -1 || user !== null) return;
    if (!isAiStatusFeedPayload(event)) return;
    // Room-wide display follows every event; requester-local teardown and
    // `onTerminal` fire only for the locally initiating run.
    const isOwnRun = event.runId === runIdRef.current;
    if (event.stage === "start" || event.stage === "processing") {
      setStage("working");
      setStatusActive(true);
      setLastMessage(event.message);
    } else if (event.stage === "complete") {
      setStage("done");
      setStatusActive(false);
      setLastMessage(event.message);
      if (!isOwnRun) return;
      if (emittedRef.current === event.runId) {
        setRunId(null);
        setPublicToken(null);
        return;
      }
      emittedRef.current = event.runId;
      setRunId(null);
      setPublicToken(null);
      onTerminal?.(event.message, true, event.runId);
    } else {
      setStage("error");
      setStatusActive(false);
      setLastMessage(event.message);
      if (!isOwnRun) return;
      if (emittedRef.current === event.runId) {
        setRunId(null);
        setPublicToken(null);
        return;
      }
      emittedRef.current = event.runId;
      setRunId(null);
      setPublicToken(null);
      onTerminal?.(event.message, false, event.runId);
    }
  });

  const reset = useCallback(() => {
    setStage("idle");
    setLastMessage(null);
    setStatusActive(false);
    setRunId(null);
    setPublicToken(null);
  }, []);

  const start = useCallback(
    async (prompt: string): Promise<boolean> => {
      const trimmed = prompt.trim();
      if (!trimmed) return false;
      setStage("working");
      setStatusActive(true);
      emittedRef.current = null;
      setLastMessage("Sending your prompt to Ghost…");
      try {
        const response = await fetch("/api/ai/design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed, projectId, roomId }),
        });
        if (!response.ok) {
          const message = await readErrorMessage(response);
          setStage("error");
          setStatusActive(false);
          setLastMessage(message);
          onTerminal?.(message, false, null);
          return false;
        }
        const triggerBody: unknown = await response.json();
        const triggeredRunId =
          typeof triggerBody === "object" && triggerBody !== null
            ? (triggerBody as { runId?: unknown }).runId
            : null;
        if (typeof triggeredRunId !== "string" || triggeredRunId.trim().length === 0) {
          const message = "Design task started but returned no run id.";
          setStage("error");
          setStatusActive(false);
          setLastMessage(message);
          onTerminal?.(message, false, null);
          return false;
        }
        setRunId(triggeredRunId);
        const tokenResponse = await fetch("/api/ai/design/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: triggeredRunId }),
        });
        if (!tokenResponse.ok) {
          const message = await readErrorMessage(tokenResponse);
          setStage("error");
          setStatusActive(false);
          setLastMessage(message);
          setRunId(null);
          onTerminal?.(message, false, null);
          return false;
        }
        const token = readToken(await tokenResponse.json());
        if (!token) {
          const message = "Run token could not be issued.";
          setStage("error");
          setStatusActive(false);
          setLastMessage(message);
          setRunId(null);
          onTerminal?.(message, false, null);
          return false;
        }
        setPublicToken(token);
        // Progress from here arrives via AI_STATUS broadcasts + the
        // realtime subscription above.
        return true;
      } catch {
        const message = "Could not reach the design service.";
        setStage("error");
        setStatusActive(false);
        setLastMessage(message);
        setRunId(null);
        setPublicToken(null);
        onTerminal?.(message, false, null);
        return false;
      }
    },
    [projectId, roomId, onTerminal],
  );

  return { stage, lastMessage, isActive, runId, start, reset };
}

export { useDesignAgent };
export type { DesignAgentStage };
