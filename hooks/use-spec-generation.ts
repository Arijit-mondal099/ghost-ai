"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoom } from "@liveblocks/react";
import { LiveObject, type LiveMap, type Lson } from "@liveblocks/client";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

import { AI_CHAT_CONTENT_MAX_LENGTH, type AiChatFeedPayload } from "@/types/tasks";

// ---------------------------------------------------------------------------
// Client bridge to the generate-spec task (spec 32).
//
// `start()` snapshots the canvas graph one-shot from room storage, maps the
// sidebar chat feed to trigger history, POSTs to `/api/ai/spec` (which
// triggers the background task and returns a run id), then mints a
// run-scoped public token via `POST /api/ai/spec/token`. The token feeds
// `useRealtimeRun`, which tracks the run to a terminal status; on
// COMPLETED the Markdown is read from the run output and persisted
// through `POST /api/projects/[projectId]/specs`, then `onSaved` refreshes
// the spec list.
//
// Structure mirrors `use-design-agent.ts` (trigger → token → realtime →
// terminal effect with an emission guard for StrictMode), minus the
// `AI_STATUS` feed — `generate-spec` never broadcasts room events, so
// progress is requester-local and no Ghost chat message is posted. On top:
// a run-identity guard (the hook's SWR cache would otherwise replay the
// previous run's terminal into a new run), a watchdog that resubscribes
// after 45s without run data (long-quiet SSE streams die silently),
// surfacing of subscription-level errors instead of hanging on Generating,
// and an absolute 6-minute timeout — resubscribing a server-stalled run
// replays EXECUTING forever, so the timeout is the only exit that can't
// be replayed away.
//
// Deliberate deviation from the realtime skill: the subscription keeps the
// `output` column (no `skipColumns`). The skill's skip guidance assumes
// unrendered columns; here the run output IS the product (the Markdown to
// persist), bounded by the task's output token cap.
//
// Must render inside `<RoomProvider>` (the Specs tab does, via the
// `CanvasRoom` children slot) for `useRoom()` to resolve.
//
// Run status values come from the pinned SDK docs
// (`node_modules/@trigger.dev/sdk/docs/realtime/run-object.mdx`).
// ---------------------------------------------------------------------------

type SpecGenStage = "idle" | "working" | "saving" | "done" | "error";

type UseSpecGenerationArgs = {
  projectId: string;
  roomId: string;
  messages: AiChatFeedPayload[];
  onSaved: () => void | Promise<void>;
};

// Realtime statuses that mean "still running" — same set as the design
// hook. Everything else terminal is either COMPLETED (success) or a
// failure variant handled as an error.
const REALTIME_ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "WAITING_FOR_DEPLOY",
  "QUEUED",
  "EXECUTING",
  "REATTEMPTING",
  "FROZEN",
  "DELAYED",
]);

// Absolute ceiling for one generation: resubscribing a still-EXECUTING run
// replays EXECUTING forever, so without this a server-side stall (Groq
// hanging inside its SDK timeout, a dead worker) pins the UI on
// "Generating spec…" with no exit. Paired with the per-attempt Groq
// timeout in `trigger/generate-spec.ts` (3 × 90s + backoff ≈ 4.6 min), so
// a healthy run always finishes first and only a true stall hits this.
const SPEC_RUN_TIMEOUT_MS = 6 * 60 * 1000;

type FlowLive = {
  nodes: LiveMap<string, LiveObject<Record<string, Lson>>>;
  edges: LiveMap<string, LiveObject<Record<string, Lson>>>;
};

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

function toTriggerHistory(
  messages: AiChatFeedPayload[],
): { role: "user" | "assistant"; content: string }[] {
  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        message.content.trim().length > 0 &&
        message.content.length <= AI_CHAT_CONTENT_MAX_LENGTH,
    )
    .slice(-50)
    .map((message) => ({ role: message.role, content: message.content }));
}

function readMarkdown(output: unknown): { markdown: string } | { error: string } {
  if (typeof output !== "object" || output === null) {
    return { error: "Spec run finished but returned no content." };
  }
  const record = output as { ok?: unknown; markdown?: unknown; error?: unknown };
  if (record.ok === true) {
    if (typeof record.markdown === "string" && record.markdown.trim().length > 0) {
      return { markdown: record.markdown };
    }
    return { error: "Spec run finished but returned no content." };
  }
  if (record.ok === false) {
    return {
      error:
        typeof record.error === "string" && record.error.trim().length > 0
          ? record.error
          : "Spec generation failed.",
    };
  }
  return { error: "Spec run finished but returned no content." };
}

function fail(
  message: string,
  setters: {
    setStage: (stage: SpecGenStage) => void;
    setStatusMessage: (message: string | null) => void;
    setRunId: (runId: string | null) => void;
    setPublicToken: (token: string | null) => void;
  },
): false {
  setters.setStage("error");
  setters.setStatusMessage(message);
  setters.setRunId(null);
  setters.setPublicToken(null);
  return false;
}

function useSpecGeneration({ projectId, roomId, messages, onSaved }: UseSpecGenerationArgs): {
  stage: SpecGenStage;
  statusMessage: string | null;
  isGenerating: boolean;
  start: () => Promise<boolean>;
} {
  const room = useRoom();
  const [stage, setStage] = useState<SpecGenStage>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  // Bumped by the watchdog to force a fresh realtime subscription (see
  // below); each key gets a fresh SWR namespace inside the hook.
  const [subscriptionKey, setSubscriptionKey] = useState(0);
  // Last time the realtime stream delivered run data. Null until the first
  // update for the current subscription — drives the watchdog below.
  const lastUpdateRef = useRef<number | null>(null);
  // Records the runId already handled to completion. Realtime re-delivery
  // of a terminal run (or a StrictMode double-effect) must not persist a
  // second spec. Any non-null value blocks handling: terminal branches store
  // the run id, the absolute timeout stores a sentinel — a late terminal
  // arriving after the timeout must not save. Cleared when a new run starts.
  const emittedRef = useRef<string | null>(null);
  // Absolute-timeout timer for the in-flight run. Cleared centrally when the
  // stage settles (effect below) and on unmount — never at individual exit
  // points, so no terminal path can leak it.
  const timeoutRef = useRef<number | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const subscribed = runId !== null && publicToken !== null;
  const { run: realtimeRun, error: realtimeError } = useRealtimeRun(runId ?? undefined, {
    accessToken: publicToken ?? undefined,
    enabled: subscribed,
    id: `spec-gen-${subscriptionKey}`,
  });
  // Only trust realtime state while subscribed — the hook caches the
  // last-seen run in SWR, and a stale terminal must not fire after teardown.
  // The cache is also keyed per hook instance, so a new run briefly sees the
  // previous run's terminal state before its own events arrive: ignore data
  // whose run id doesn't match (a second generation would otherwise persist
  // the first run's Markdown and ignore its own).
  const runIdentity = (realtimeRun as { id?: unknown } | undefined)?.id;
  const currentRun =
    subscribed && (typeof runIdentity !== "string" || runIdentity === runId)
      ? realtimeRun
      : undefined;
  const realtimeStatus: string | undefined = (currentRun as { status?: string } | undefined)
    ?.status;
  const realtimeOutput: unknown = (currentRun as { output?: unknown } | undefined)?.output;

  useEffect(() => {
    if (currentRun !== undefined && runId !== null) lastUpdateRef.current = Date.now();
  }, [currentRun, runId]);

  // Watchdog: the SSE stream can die silently (proxies/NATs kill long-quiet
  // connections — the 60s compact-retry wait is one such silence), leaving
  // the UI on "Generating spec…" forever. If no run data arrives for 45s,
  // force a fresh subscription; the server replays current state on
  // subscribe, so the terminal is eventually observed.
  useEffect(() => {
    if (!subscribed || stage !== "working") return;
    const timer = setInterval(() => {
      if (lastUpdateRef.current !== null && Date.now() - lastUpdateRef.current > 45_000) {
        lastUpdateRef.current = Date.now();
        setSubscriptionKey((key) => key + 1);
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [subscribed, stage, runId]);

  // Subscription-level failure (auth/network): the hook reports it via
  // `error` while the run state stays stale — surface it instead of hanging
  // on "Generating spec…".
  useEffect(() => {
    if (!subscribed || stage !== "working" || runId === null) return;
    if (!realtimeError) return;
    if (emittedRef.current !== null) return;
    emittedRef.current = runId;
    console.error("Spec run subscription failed", realtimeError);
    setStage("error");
    setStatusMessage("Lost connection to the spec run. Try again.");
    setRunId(null);
    setPublicToken(null);
  }, [subscribed, stage, runId, realtimeError]);

  // Central timer cleanup: any settled stage (error after a failure, idle
  // after a save) disarms the absolute timeout, so terminal branches never
  // manage the timer themselves. Unmount clears it too.
  useEffect(() => {
    if (stage !== "error" && stage !== "idle") return;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [stage]);
  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  // Completion effect: terminal run status → persist output or report.
  useEffect(() => {
    if (realtimeStatus === undefined) return;
    if (REALTIME_ACTIVE_STATUSES.has(realtimeStatus)) return;
    if (runId === null || emittedRef.current !== null) return;
    if (stage !== "working") return;
    if (realtimeStatus !== "COMPLETED") {
      emittedRef.current = runId;
      setStage("error");
      setStatusMessage(`Spec run ended (${realtimeStatus}). Try again.`);
      setRunId(null);
      setPublicToken(null);
      return;
    }
    const result = readMarkdown(realtimeOutput);
    if ("error" in result) {
      emittedRef.current = runId;
      setStage("error");
      setStatusMessage(result.error);
      setRunId(null);
      setPublicToken(null);
      return;
    }
    emittedRef.current = runId;
    setStage("saving");
    setStatusMessage("Saving spec…");
    fetch(`/api/projects/${projectId}/specs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: result.markdown }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readErrorMessage(response));
        await onSavedRef.current();
        setStage("idle");
        setStatusMessage(null);
        setRunId(null);
        setPublicToken(null);
      })
      .catch((error: unknown) => {
        console.error("Failed to save generated spec", error);
        setStage("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Could not save the generated spec.",
        );
        setRunId(null);
        setPublicToken(null);
      });
  }, [realtimeStatus, realtimeOutput, stage, runId, projectId]);

  const start = useCallback(async (): Promise<boolean> => {
    if (stage === "working" || stage === "saving") return false;
    const setters = { setStage, setStatusMessage, setRunId, setPublicToken };
    setStage("working");
    setStatusMessage("Preparing canvas snapshot…");
    emittedRef.current = null;
    // Arm the watchdog from dispatch time so even a stream that never
    // delivers is resubscribed; reset the subscription namespace for the
    // new run (the identity guard above still filters stale cache).
    lastUpdateRef.current = Date.now();
    setSubscriptionKey(0);
    // Absolute ceiling: a server-side stall (provider hanging, dead worker)
    // replays EXECUTING through every resubscribe, so without this the UI
    // pins on "Generating spec…" forever. Fires only if no terminal path
    // claimed the run first (sentinel blocks late terminals from saving);
    // disarmed by the stage-settle effect above.
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      if (emittedRef.current !== null) return;
      emittedRef.current = "timeout";
      console.error("Spec run timed out without a terminal status");
      setStage("error");
      setStatusMessage("Spec run timed out after 6 minutes. Try again.");
      setRunId(null);
      setPublicToken(null);
    }, SPEC_RUN_TIMEOUT_MS);
    // One-shot graph snapshot: read (never subscribe) the `flow` LiveObject
    // via the room, with the same LSON-cast-at-the-boundary pattern as
    // `use-canvas-template-load`. `toJSON()` deep-converts to plain JSON —
    // local-only flags (`selected`/`dragging`) are already absent from
    // storage. A room never opened in the canvas has no `flow` key yet.
    let nodes: unknown[];
    let edges: unknown[];
    try {
      const storage = await room.getStorage();
      const flow = storage.root.get("flow" as never) as unknown as LiveObject<FlowLive> | undefined;
      const liveNodes = flow?.get("nodes");
      const liveEdges = flow?.get("edges");
      nodes = liveNodes ? Object.values(liveNodes.toJSON()) : [];
      edges = liveEdges ? Object.values(liveEdges.toJSON()) : [];
    } catch (error) {
      console.error("Failed to snapshot canvas for spec generation", error);
      return fail("Could not read the canvas. Try again.", setters);
    }
    setStatusMessage("Generating spec…");
    try {
      const response = await fetch("/api/ai/spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, chatHistory: toTriggerHistory(messages), nodes, edges }),
      });
      if (!response.ok) {
        return fail(await readErrorMessage(response), setters);
      }
      const triggerBody: unknown = await response.json();
      const triggeredRunId =
        typeof triggerBody === "object" && triggerBody !== null
          ? (triggerBody as { runId?: unknown }).runId
          : null;
      if (typeof triggeredRunId !== "string" || triggeredRunId.trim().length === 0) {
        return fail("Spec task started but returned no run id.", setters);
      }
      setRunId(triggeredRunId);
      const tokenResponse = await fetch("/api/ai/spec/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: triggeredRunId }),
      });
      if (!tokenResponse.ok) {
        setRunId(null);
        return fail(await readErrorMessage(tokenResponse), setters);
      }
      const token = readToken(await tokenResponse.json());
      if (!token) {
        setRunId(null);
        return fail("Run token could not be issued.", setters);
      }
      setPublicToken(token);
      // Progress from here arrives via the realtime subscription above.
      return true;
    } catch (error) {
      console.error("Failed to start spec generation", error);
      return fail("Could not reach the spec service.", setters);
    }
  }, [stage, room, roomId, messages]);

  return {
    stage,
    statusMessage,
    isGenerating: stage === "working" || stage === "saving",
    start,
  };
}

export { useSpecGeneration };
export type { SpecGenStage };
