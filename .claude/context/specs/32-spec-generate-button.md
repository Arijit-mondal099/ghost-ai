Wire the Specs tab Generate Spec button to the real backend flow so users can generate a spec from the current canvas without leaving the editor.

### Implementation

1. Generate action

- enable the Generate Spec button in the AI sidebar Specs tab
- on click, snapshot the current canvas graph (nodes + edges) from the Liveblocks room storage
- include recent chat history (user/assistant roles only) from the sidebar feed
- `POST /api/ai/spec` with `{ roomId, chatHistory, nodes, edges }` to start the run
- mint the run token via `POST /api/ai/spec/token`
- subscribe to the run with `useRealtimeRun` until it reaches a terminal status
- on completion, read the Markdown from the run output and persist it via `POST /api/projects/[projectId]/specs`
- refresh the spec list when the save lands

2. Progress + error states

- disable the button while a run is in flight; show status text (generating / saving)
- surface trigger, token, run-failure, and save errors inline in the Specs tab
- a second click while running must not start a duplicate run

### UI Details

- reuse the existing Generate Spec button placement and styling; only its enabled state and label change
- status/error lines use existing text tokens and the `role="alert"` pattern from the list states
- follow `ui-context.md` for spacing and layout; no sidebar redesign

### Scope Limits

- do not change the trigger route, token route, task, save route, or download route
- do not access Blob directly from the client
- do not broadcast spec status to the room (no `AI_STATUS` equivalent; progress is requester-local)
- do not post Ghost chat messages for spec runs
- do not add new global state

### Notes

- reuse the `use-design-agent.ts` structure (trigger → token → `useRealtimeRun` → terminal handling) but subscribe WITH the run output — the Markdown is the product here, so the skill's `skipColumns` guidance does not apply
- snapshot the graph one-shot via `room.getStorage()` + `toJSON()`; never subscribe the sidebar to the graph
- chat history mapping must satisfy `parseSpecTriggerBody` (max 50 entries, non-empty content within the length cap)

### Check When Done

- clicking Generate Spec starts a run and disables the button
- status text tracks generating → saving
- the new spec appears in the list after save
- trigger/token/run/save failures show inline errors and re-enable the button
- TypeScript and build pass
