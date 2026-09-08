Add shared AI activity indicators so everyone in the room can see when generation is in progress. This unit is only for UI, presence, and realtime status signals. Do not add the actual AI generation flow yet.

## Implementation

1. Add AI thinking state to the sidebar.
   - show a small status indicator when AI is working
   - make the status visible to everyone currently in the room, including
     collaborators who join mid-run: the latest status is persisted to
     Storage (`aiStatus`) so late joiners replay it on mount; the ephemeral
     `AI_STATUS` RoomEvent remains the low-latency fast path for connected
     clients
   - disable the chat input while generation is active
   - show a loading state on the send button
   - keep the rest of the sidebar usable

2. Add a shared AI status feed.
   - check the existing Liveblocks setup and installed agent-related features first
   - follow Liveblocks best practices for feeds/presence instead of creating parallel realtime state
   - create or reuse a Liveblocks feed named `ai-status-feed`
   - persist the latest feed message to Storage (`aiStatus` LiveObject) so it
     replays for late joiners; keep the `AI_STATUS` broadcast for live fanout
   - subscribe to the latest feed message in the sidebar (Storage snapshot +
     live events)
   - show only the most recent status message
   - keep the feed generic enough for design and spec generation later

3. Add status message validation.
   - define the feed payload schema in `types/tasks.ts`, mirroring the shared
     `AI_STATUS` RoomEvent in `liveblocks.config.ts` as the source of truth
   - require `runId`, `stage` (`start | processing | complete | error`), and `message`
   - validate incoming RoomEvents and Storage snapshots before displaying them;
     display uses `message` (same field `use-design-agent.ts` reads)

4. Add thinking indicators to live cursors.
   - when a participant has `isThinking: true` in presence (the existing field
     in `liveblocks.config.ts`), show a small spinner in their cursor name badge
   - hide the spinner when `isThinking` is false or missing

## Scope Limits

- don’t add actual AI generation logic
- don’t trigger background tasks yet
- don’t block or dim the whole sidebar
- don’t show full feed history
- keep this focused on shared AI activity state only

## Check When Done

- Sidebar can render shared AI status from `ai-status-feed`.
- Chat input and send button respond to active generation state.
- Cursor badges read `isThinking` from presence.
- Feed messages are validated through the task schema.
- `bun run build` passes.
