// Pure cursor-color helper (no `server-only`, safe for `bun:test`).
// Source of truth for the palette + djb2 mapping; `lib/liveblocks.ts`
// re-exports it so existing imports keep working.

export const CURSOR_COLORS: readonly string[] = [
  "#52A8FF", // blue
  "#BF7AF0", // purple
  "#FF990A", // orange
  "#FF6166", // red
  "#F75F8F", // pink
  "#62C073", // green
  "#0AC7B4", // teal
  "#EDEDED", // neutral light
] as const;

export function cursorColorForUserId(userId: string): string {
  if (userId.length === 0) return CURSOR_COLORS[0];
  // djb2 — simple, deterministic, distributed enough for 8 slots.
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash + userId.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
