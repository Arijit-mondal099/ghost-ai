"use client";

import { useEffect, useState } from "react";
import { useEventListener, useStorage } from "@liveblocks/react";

import { isAiStatusFeedPayload } from "@/types/tasks";

// ---------------------------------------------------------------------------
// Simulated AI presence for the collaborative canvas (specs 24 + 25).
//
// A Trigger.dev task has no Liveblocks connection, so it cannot set real
// presence. Instead every client renders this overlay from the shared
// `AI_STATUS` feed: RoomEvents for low-latency fanout plus the persisted
// `aiStatus` Storage key for late-joiner replay (RoomEvents never reach
// collaborators who join mid-run). While a design run is active, a Ghost
// cursor + thinking badge floats over the canvas on ALL connected screens;
// it clears on `complete` / `error`. Display-only and `pointer-events-none`
// — same contract as `LiveCursors`, but driven by broadcasts + Storage
// instead of `useOthers`.
// ---------------------------------------------------------------------------

function AiPresenceOverlay() {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  // Regular hook (null-safe): the canvas surface suspends on the flow graph,
  // but this overlay must also render before any status was ever persisted.
  const storedStatus = useStorage((root) => root.aiStatus);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Late-joiner replay: adopt the persisted snapshot when locally idle.
  // Skipped while already active so a stale snapshot never clobbers live events.
  useEffect(() => {
    if (!storedStatus || active) return;
    const snapshot: unknown = storedStatus;
    if (!isAiStatusFeedPayload(snapshot)) return;
    if (snapshot.runId === "init") return;
    if (snapshot.stage === "complete" || snapshot.stage === "error") return;
    setActive(true);
    setMessage(snapshot.message);
  }, [storedStatus, active]);

  useEventListener(({ event, connectionId, user }) => {
    if (event.type !== "AI_STATUS") return;
    // Same origin guard as `use-design-agent.ts`: only the task's server
    // broadcasts drive the overlay; client-spoofed stages are ignored.
    if (connectionId !== -1 || user !== null) return;
    if (!isAiStatusFeedPayload(event)) return;
    if (event.stage === "complete" || event.stage === "error") {
      setActive(false);
      setMessage("");
    } else {
      setActive(true);
      setMessage(event.message);
    }
  });

  if (!mounted || !active) return null;

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M3 2 L17 9 L10 11 L8 18 Z"
            fill="var(--accent-ai)"
            stroke="var(--bg-base)"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute top-4 left-4 flex flex-col gap-1">
          <span className="w-fit rounded-md border border-surface-border bg-ai px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-ai-text">
            Ghost
          </span>
          {message ? (
            <span className="w-fit max-w-56 rounded-xl border border-surface-border bg-elevated/95 px-2 py-1 font-mono text-[10px] whitespace-normal text-copy-secondary shadow-lg backdrop-blur-md">
              {message}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { AiPresenceOverlay };
