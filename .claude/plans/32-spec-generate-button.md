# Plan: 32 Spec Generate Button — Trigger → Realtime → Save Wiring

## Context

Spec `.claude/context/specs/32-spec-generate-button.md` fixes the dead
"Generate Spec (coming soon)" button the screenshot caught: the full
backend chain already exists (spec 29 trigger + token + `generate-spec`
task returning `{ ok, markdown }`; spec 30 save route; spec 31 list UI),
but nothing in the client starts a run. This unit is frontend-only.

**Current state:**

- `components/ai-sidebar/specs-tab.tsx` renders a disabled Generate
  button; `tabs.tsx:93` renders `<SpecsTab projectId={projectId} />`.
- `AISidebarTabs` already owns `messages: AiChatFeedPayload[]` (via
  `useAiChatFeed`) plus `projectId`/`roomId` props — everything the
  trigger needs except the graph.
- The graph lives in the `flow` LiveObject owned by
  `useLiveblocksFlow` (`CanvasSurface`, inside suspense). The sidebar
  lives inside `RoomProvider` but OUTSIDE `ClientSideSuspense`
  (`canvas-room.tsx:299`), so it must use non-suspense reads only.
- `POST /api/ai/spec` accepts `{ roomId, chatHistory, nodes, edges }`
  (no `projectId` — validator rejects it); `POST /api/ai/spec/token`
  accepts `{ runId }` → `{ token }` (1h expiry).

## Files to Create

```
hooks/use-spec-generation.ts   # start → token → realtime → save
```

## Files to Modify

1. `components/ai-sidebar/specs-tab.tsx` — enabled button + status/error + hook wiring.
2. `components/ai-sidebar/tabs.tsx` — pass `roomId` + `messages` into `<SpecsTab />`.
3. `.claude/context/progress-tracker.md` — record implementation state.

No backend, `trigger/`, canvas, `components/ui/*`, or dep changes.
No migration. No global state.

## Design

### Hook (`hooks/use-spec-generation.ts`)

Mirrors `hooks/use-design-agent.ts` (trigger → token → `useRealtimeRun`
→ terminal effect with an `emittedRef` once-guard for StrictMode), minus
the `AI_STATUS` feed — `generate-spec` never broadcasts room events, so
progress is requester-local:

```ts
type SpecGenStage = "idle" | "working" | "saving" | "done" | "error";
useSpecGeneration({ projectId, roomId, messages, onSaved }) → {
  stage, statusMessage, isGenerating, start,
}
```

`start()`:

1. Guard: no-op while `isGenerating`.
2. Snapshot the graph one-shot: `const storage = await room.getStorage()`
   (`useRoom()` from `@liveblocks/react`, non-suspense, valid in the
   children slot); `storage.get("flow" as never)` with the same
   LSON-cast-at-the-boundary pattern as `use-canvas-template-load.ts`;
   `nodes = Object.values(liveNodes.toJSON())`,
   `edges = Object.values(liveEdges.toJSON())`. Missing `flow` (room
   never opened in canvas) → empty arrays. Storage failure → error
   stage, "Could not read the canvas."
3. Map history: `messages` → filter non-empty trimmed content within
   `AI_CHAT_CONTENT_MAX_LENGTH` → `.slice(-50)` → `{ role, content }`
   (satisfies `parseSpecTriggerBody`; empty history is valid).
4. `POST /api/ai/spec` → `{ runId }`; `POST /api/ai/spec/token` →
   `{ token }`. Either failure → error stage, server message, no run.
5. `setRunId` + `setPublicToken` → subscribes below.

Subscription: `useRealtimeRun(runId ?? undefined, { accessToken,
enabled: subscribed })` — deliberately WITHOUT `skipColumns` (deviation
from the realtime skill's skip guidance, which assumes unrendered
columns: here the run output IS the product). Terminal effect:

- `COMPLETED` → validate `run.output` as
  `{ ok: true, markdown: non-empty string }`. Valid → stage `saving`,
  `POST /api/projects/${projectId}/specs { markdown }` → `onSaved()`
  (list refresh) → stage `done`, "Spec saved." then idle reset so the
  button re-enables (the new list row is the persistent feedback).
  `{ ok: false, error }` → error stage with the task's message.
  Malformed output → "Spec run finished but returned no content."
- Other terminal statuses (same active set as the design hook:
  `WAITING_FOR_DEPLOY/QUEUED/EXECUTING/REATTEMPTING/FROZEN/DELAYED` per
  the pinned SDK `run-object.mdx`) → error stage,
  `Spec run ended (${status}). Try again.`
- Teardown clears `runId`/`publicToken` (unsubscribe) exactly once via
  the emission guard.

Save failure (non-2xx/network) → error stage with the server message;
the Markdown is dropped (run output is ephemeral — user retries by
pressing Generate again; no local caching per scope).

### Specs tab (`specs-tab.tsx`)

Props `{ projectId, roomId, messages }`. Instantiates the hook with
`onSaved: () => void refresh()` from its own `useProjectSpecs`:

- Button enabled unless `isGenerating`; labels: `Generate Spec` /
  `Generating spec…` / `Saving spec…` with `LoaderCircleIcon` spinner
  while busy (same icon the chat input uses — `Loader2Icon` does not
  exist in lucide-react 1.x).
- `statusMessage` line under the button while busy; error line with
  `role="alert"` on failure (persists until the next start).
- `aria-label="Generate spec"` (drop the "(coming soon)" label).
- No room broadcast, no Ghost message, no composer changes — the
  Architect tab is untouched.

### Wiring (`tabs.tsx`)

`<SpecsTab projectId={projectId} roomId={roomId} messages={messages} />`
— all three already in scope, one-line change.

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt` (touched files) →
  `build` clean.
- Maps to Check-When-Done: click → button disables, status tracks
  generating → saving, new row appears, failures show inline + button
  re-enables, TS + build pass.
- Live matrix (needs `TRIGGER_SECRET_KEY` + `GROQ_API_KEY` in trigger
  env + `trigger dev` + a non-empty canvas): Generate → run appears in
  dashboard → modal list gains a row → preview renders the Markdown;
  double-click during run starts nothing new; failed run (e.g. no Groq
  key) surfaces the task error inline.

## Risks

- **Output over realtime:** subscribing with the output column pulls up
  to ~16KB+ over the socket at completion. Bounded by the Groq
  `max_tokens: 4000` cap; the alternative (a new backend run-output
  route) is more scope for no benefit.
- **One-shot snapshot staleness:** nodes/edges are read at click time;
  collaborator edits mid-run are not included. Matches the save-route
  contract (client-submitted content) and avoids subscribing the
  sidebar to the graph.
- **`flow` missing:** a room never opened in the canvas has no `flow`
  key — treated as an empty graph (validator-legal), not an error.
