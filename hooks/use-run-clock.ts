"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Run clock: seconds elapsed since mount, formatted `M:SS`. Both run
// surfaces (Architect status, spec progress) mount with their run, so
// mount time is run time — no start timestamp needs threading through.
// Display only: callers must mark the output `aria-hidden` so the ticking
// clock never spams screen-reader live regions.
// ---------------------------------------------------------------------------

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function useRunClock(): string {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return formatElapsed(Math.max(0, Math.floor((now - startedAt) / 1000)));
}

export { useRunClock };
