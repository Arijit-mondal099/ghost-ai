"use client";

import { useCallback, useEffect, useState } from "react";
import { useEventListener } from "@liveblocks/react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

// ---------------------------------------------------------------------------
// Client bridge to the design agent task (specs 24 + 27).
//
// `start(prompt)` POSTs to `/api/ai/design` (which triggers the background
// task and returns a run id), then mints a run-scoped public token via
// `POST /api/ai/design/token`. The token feeds `useRealtimeRun`, which
// tracks the Trigger.dev run lifecycle directly; progress text arrives as
// room-wide `AI_STATUS` RoomEvents broadcast by the task itself — so every
// connected client, not just the requester, observes the same status feed
// through this hook.
//
// `isActive` is the union of both signals: the `AI_STATUS` stage and the
// realtime run status. Realtime also acts as a backstop — if the run reaches
// a terminal status without a matching `AI_STATUS` terminal event (e.g. an
// older task version that never broadcasts), the hook resets and surfaces a
// fallback message through `onTerminal` exactly once.
//
// Terminal stages (`complete` / `error`, from either source) are surfaced
// twice: as sticky `lastMessage` state for status displays, and via the
// optional `onTerminal` callback so chat histories can append exactly one
// assistant message per run. The callback fires from the event listener or
// from the guarded realtime effect (both check the current stage first, and
// the stage flip makes them mutually exclusive), so StrictMode
// double-effects cannot duplicate messages.
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
  onTerminal?: (message: string, ok: boolean) => void;
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
  // makes this mutually exclusive with the listener path below.
  useEffect(() => {
    if (realtimeStatus === undefined) return;
    if (REALTIME_ACTIVE_STATUSES.has(realtimeStatus)) return;
    if (realtimeStatus === "COMPLETED") {
      if (stage !== "working") return;
      const message = "Design applied to the canvas.";
      setStage("done");
      setStatusActive(false);
      setLastMessage(message);
      setRunId(null);
      setPublicToken(null);
      onTerminal?.(message, true);
    } else {
      if (stage !== "working") return;
      const message = `Design run ended (${realtimeStatus}). Try again.`;
      setStage("error");
      setStatusActive(false);
      setLastMessage(message);
      setRunId(null);
      setPublicToken(null);
      onTerminal?.(message, false);
    }
  }, [realtimeStatus, stage, onTerminal]);

  useEventListener(({ event }) => {
    if (event.type !== "AI_STATUS") return;
    if (event.stage === "start" || event.stage === "processing") {
      setStage("working");
      setStatusActive(true);
      setLastMessage(event.message);
    } else if (event.stage === "complete") {
      setStage("done");
      setStatusActive(false);
      setLastMessage(event.message);
      setRunId(null);
      setPublicToken(null);
      onTerminal?.(event.message, true);
    } else {
      setStage("error");
      setStatusActive(false);
      setLastMessage(event.message);
      setRunId(null);
      setPublicToken(null);
      onTerminal?.(event.message, false);
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
          onTerminal?.(message, false);
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
          onTerminal?.(message, false);
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
          onTerminal?.(message, false);
          return false;
        }
        const token = readToken(await tokenResponse.json());
        if (!token) {
          const message = "Run token could not be issued.";
          setStage("error");
          setStatusActive(false);
          setLastMessage(message);
          setRunId(null);
          onTerminal?.(message, false);
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
        onTerminal?.(message, false);
        return false;
      }
    },
    [projectId, roomId, onTerminal],
  );

  return { stage, lastMessage, isActive, runId, start, reset };
}

export { useDesignAgent };
export type { DesignAgentStage };
