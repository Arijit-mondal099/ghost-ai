// ---------------------------------------------------------------------------
// Server-only Liveblocks infrastructure.
//
// Exports:
//   - `liveblocks`        — cached `Liveblocks` client (one per process).
//   - `CURSOR_COLORS`     — palette source of truth for the cursor color helper
//                           and any future client-side cursor renderer.
//   - `cursorColorForUserId` — deterministic user-id → color mapping.
//
// The `Liveblocks` client wraps a fetch-based HTTP connection, so constructing
// it on every request would re-open sockets and re-resolve DNS. We stash the
// instance on `globalThis` in non-production so Next.js dev hot-reloads reuse
// it; in production the module is evaluated once and the cache is bypassed.
// (Same pattern as `lib/prisma.ts`.)
//
// The color helper is intentionally pure: djb2 hash → mod palette length.
// Eight slots give ~12.5% collision rate, which is fine for a visual cue —
// adjacent collisions only show two cursors in the same hue, never a wrong
// user being identified.
// ---------------------------------------------------------------------------

import "server-only";

import { Liveblocks } from "@liveblocks/node";

export { CURSOR_COLORS, cursorColorForUserId } from "@/lib/cursor-color";

function createLiveblocksClient(): Liveblocks {
  const secret = process.env["LIVEBLOCKS_SECRET_KEY"];
  if (!secret) {
    throw new Error("LIVEBLOCKS_SECRET_KEY is not set");
  }
  return new Liveblocks({ secret });
}

interface GlobalForLiveblocks {
  liveblocksGlobal?: Liveblocks;
}

const globalRef = globalThis as typeof globalThis & GlobalForLiveblocks;

export const liveblocks: Liveblocks = globalRef.liveblocksGlobal ?? createLiveblocksClient();

if (process.env["NODE_ENV"] !== "production") {
  globalRef.liveblocksGlobal = liveblocks;
}
