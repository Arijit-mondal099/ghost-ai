"use client";

import { useEffect, useRef, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Rate-limit overlay for the collaborative canvas.
//
// Rendered when the Liveblocks auth endpoint answers 429 (see `CanvasRoom`):
// the room cannot connect, so the suspense fallback would otherwise sit on
// "Connecting…" forever with no explanation. The overlay covers the canvas
// area with a warning, a live countdown derived from the server's
// `Retry-After`, and a manual retry. When the countdown reaches zero it
// fires `onRetry` once (auto-reconnect); a still-limited server answers 429
// again and the parent re-mounts this overlay with a fresh countdown, so
// the loop is bounded by the server and costs one cheap auth call per
// cycle (no room creation, no billable work).
// ---------------------------------------------------------------------------

type RateLimitOverlayProps = {
  retryAfterSec: number;
  onRetry: () => void;
};

function RateLimitOverlay({ retryAfterSec, onRetry }: RateLimitOverlayProps) {
  const [remaining, setRemaining] = useState(Math.max(1, retryAfterSec));
  // Guard against double-fire under StrictMode double-effects.
  const firedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onRetry();
    }
  }, [remaining, onRetry]);

  return (
    <div
      role="alert"
      className="absolute inset-0 z-50 flex items-center justify-center bg-base/95 backdrop-blur-md"
    >
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-surface-border bg-surface px-6 py-8 text-center">
        <TriangleAlertIcon className="h-8 w-8 text-warning" aria-hidden="true" />
        <p className="font-medium text-copy-primary">Too many requests</p>
        <p className="text-sm text-copy-muted" aria-live="polite">
          {remaining > 0
            ? `Your connection was rate limited. Retrying in ${remaining}s…`
            : "Retrying now…"}
        </p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Retry now
        </Button>
      </div>
    </div>
  );
}

export { RateLimitOverlay };
export type { RateLimitOverlayProps };
