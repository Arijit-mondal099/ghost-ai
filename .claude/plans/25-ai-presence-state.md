# Plan: 25 AI Presence State — Shared Thinking UI on the Existing `AI_STATUS` Feed

## Context

Spec `.claude/context/specs/25-ai-presence-state.md` is UI + presence + realtime
status only. No AI generation logic, no background task triggers.

**What already exists (do not rebuild):**

- `liveblocks.config.ts` — `Presence { cursor, isThinking }`, `RoomEvent`
  `{ type: "AI_STATUS"; runId; stage: start|processing|complete|error; message }`.
  Ephemeral broadcast via `liveblocks.broadcastEvent` from `trigger/design-agent.ts`,
  received via `useEventListener` — room-wide, no history. Already satisfies
  "visible to everyone" and "show only most recent".
- `hooks/use-design-agent.ts` — POSTs to `/api/ai/design`, listens for `AI_STATUS`,
  exposes `{ stage, lastMessage, isActive, start }`. Both consumers
  (`components/ai-sidebar/tabs.tsx`,
  `components/editor/canvas/ai-presence-overlay.tsx`) already sit inside
  `RoomProvider` via the `CanvasRoom` children slot.
- `components/ai-sidebar/tabs.tsx` — composer already locks via
  `disabled={isActive}`. `chat-input.tsx` send disables when empty/disabled.
- `components/editor/canvas/live-cursors.tsx` — remote cursors + name badges,
  currently ignores the thinking flag. `use-presence-cursor.ts` preserves
  `isThinking` across patches but nothing ever sets it `true`.

**Approved decisions (user answered clarifying questions):**

- Status feed → reuse `AI_STATUS` as the logical `ai-status-feed` (typed wrapper
  - validator in `types/tasks.ts`). No new Storage key, no inbox, no parallel state.
- Presence field → keep `isThinking` as source of truth (plan 19 decision stands);
  badge tolerates spec's `thinking` wording at runtime, no type rename.
- Thinking indicator → header status line in the AI sidebar, not a new banner.

## Files to Create

```
types/tasks.ts                  # AiStatus feed payload schema + validator (client+server safe, no @/ imports)
hooks/use-ai-status-feed.ts     # useAiStatusFeed(): subscribe to latest validated AI_STATUS only
```

## Files to Modify

1. `components/ai-sidebar/tabs.tsx` — derive `isActive`/`lastMessage` from the feed
   hook; keep `start()` from `useDesignAgent`; pass down to header + input.
2. `components/ai-sidebar/header.tsx` — accept `{ isActive, statusText? }`; swap
   dot/text to working state when active. No layout change.
3. `components/ai-sidebar/chat-input.tsx` — accept `isGenerating`; spinner on the
   send button while active. Textarea stays `disabled`; rest of sidebar usable.
4. `components/editor/canvas/live-cursors.tsx` — read thinking flag; spinner in the
   name badge when true.
5. `liveblocks.config.ts` — comment only (document `ai-status-feed` = `AI_STATUS`
   channel). No type change.
6. `.claude/context/progress-tracker.md` — record implementation state.

No `trigger/`, `app/api/`, `Storage`, or `Presence` type changes. No new deps.

## Design

### Feed schema (`types/tasks.ts`)

```ts
export const AI_STATUS_FEED = "ai-status-feed" as const;
export type AiStatusStage = "start" | "processing" | "complete" | "error";
export type AiStatusFeedPayload = {
  runId: string;
  stage: AiStatusStage;
  message: string;
  text?: string; // optional per spec; display fallback
};
export function isAiStatusFeedPayload(v: unknown): v is AiStatusFeedPayload;
export function aiStatusDisplayText(v: AiStatusFeedPayload): string; // message || text || ""
```

Validation via `asRecord`: `runId` non-empty string, `stage` allow-list, `message`
string, `text` string-if-present. Invalid → caller keeps previous message, never
renders unvalidated content. No `design`/`spec` literals — spec generation reuses
the same feed later with a different `runId`.

### Feed hook (`hooks/use-ai-status-feed.ts`)

- `useState<{ stage, message } | null>` — latest only, no history array.
- `useEventListener(({ event }) => { if (event.type !== "AI_STATUS") return; if (!isAiStatusFeedPayload(event)) return; setLatest(...) })`.
- `isActive = stage === "start" || stage === "processing"`. Terminal
  `complete`/`error` sets `isActive=false` but keeps sticky `lastMessage`.
- Must render inside `RoomProvider` (sidebar via `CanvasRoom` children slot).
- Avoid drift: `useDesignAgent` keeps `start()` but derives display status from
  this hook (or `tabs.tsx` calls the feed hook for display + `useDesignAgent`
  for `start`). Single subscription per tree, lifted to `AISidebarTabs`.

### Sidebar thinking state

- `tabs.tsx`: `const { lastMessage, isActive } = useAiStatusFeed()` +
  `const { start } = useDesignAgent(...)`; pass `isActive` to header and
  `<ChatInput disabled={isActive} isGenerating={isActive} />`.
- `header.tsx`: active → indigo pulse (`bg-ai`, `text-ai-text`) +
  `"Ghost is working…"` + truncated `statusText` (`truncate`, `aria-live="polite"`);
  idle → existing green `"Drafting with you"`. Close button, tabs, specs tab stay
  enabled — no sidebar-wide dim/block (scope limit).
- `chat-input.tsx`: `isGenerating` renders `<LoaderCircleIcon className="animate-spin" />`
  instead of `<ArrowUpIcon />`, `aria-label="Ghost is working"`. Enter/Shift+Enter,
  IME guard, auto-resize untouched.

### Cursor thinking badges (`live-cursors.tsx`)

```ts
const thinking =
  other.presence?.isThinking ??
  (other.presence as { thinking?: boolean } | undefined)?.thinking ??
  false;
```

Badge becomes `flex items-center gap-1`; when `thinking`, append
`<LoaderCircleIcon className="h-3 w-3 animate-spin" aria-hidden />`.
`pointer-events-none`, colors, `z-30` unchanged. Hidden when `cursor` is null
(existing filter) and when flag is false/missing.

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt:check` (touched files) → `build`.
- Static: bad payload (missing `runId`, bad `stage`, non-string `message`) keeps
  previous message; `text`-only payload displays `text`.
- Live two-client matrix (needs `trigger dev` + keys from spec 24): prompt on A →
  both sidebars show working header, both composers disabled with spinner send,
  only latest message shown, tabs/close/specs still clickable; terminal event
  re-enables both. Cursor spinner verified statically (inject presence in
  devtools) — no writer sets `isThinking:true` yet (out of scope).

## Risks

- **No `isThinking` writer exists.** Spec 25 only reads the flag. Spinner rarely
  appears live until a future spec sets `isThinking:true` during runs.
- **Listener duplication.** `useDesignAgent` + feed hook must share
  `isAiStatusFeedPayload`; prefer nesting `useDesignAgent` on the feed hook.
- **Over-validation.** Validator must accept current `design-agent.ts` broadcasts
  (`{type, runId, stage, message}` without `text`) — `text` is optional, never required.
