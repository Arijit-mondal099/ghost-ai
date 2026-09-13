# Plan: 40 PENDING_VERSION misclassified as terminal run failure

## Context

Spec `.claude/context/specs/40-pending-version-status.md`.

**Current state (verified):**

- `hooks/use-design-agent.ts:65-74` — `REALTIME_ACTIVE_STATUSES` holds
  `WAITING_FOR_DEPLOY, QUEUED, EXECUTING, REATTEMPTING, FROZEN, DELAYED`.
  The realtime backstop (`:186-212`) returns early on active, maps
  `COMPLETED` to success, and maps everything else to
  `` `Design run ended (${realtimeStatus}). Try again.` `` with teardown.
  So `PENDING_VERSION` hits the error branch.
- `hooks/use-spec-generation.ts:60-70` — identical set, identical shape:
  backstop (`:276-289`) maps non-`COMPLETED` non-active to
  `` `Spec run ended (${realtimeStatus}). Try again.` ``.
- Authoritative statuses: zod `RunStatus`
  (`node_modules/@trigger.dev/core/dist/.../schemas/api.d.ts:9681`):
  `PENDING_VERSION, QUEUED, DEQUEUED, EXECUTING, WAITING, COMPLETED,
CANCELED, FAILED, CRASHED, SYSTEM_FAILURE, DELAYED, EXPIRED, TIMED_OUT`.
  Stream queued list (`core/dist/.../apiClient/runStream.js:597`):
  `PENDING_VERSION, QUEUED, PENDING, DELAYED`.
- `docs/troubleshooting.md:31` already has the one-line prod hint
  (`trigger deploy`); it never names `PENDING_VERSION`.
- Both hooks cite the stale `run-object.mdx` as the status source; that
  file lists `WAITING_FOR_DEPLOY` and omits the new names.

**Locked decision:** treat the queued statuses as active (stay subscribed,
stay working). No new timeout, no shared helper, no behavior change for
true terminals.

## Files to Create

None.

## Files to Modify

1. `hooks/use-design-agent.ts` — extend `REALTIME_ACTIVE_STATUSES` with
   `PENDING_VERSION`, `WAITING`, `DEQUEUED`, `PENDING`; refresh the comment
   to cite the zod schema + `runStream.js` queued list.
2. `hooks/use-spec-generation.ts` — same set + comment change.
3. `docs/troubleshooting.md` — expand the `Run never starts` bullet with
   the `PENDING_VERSION` checklist.
4. `.claude/context/progress-tracker.md` — record implementation state.

No server, Trigger task, Liveblocks, Blob, Prisma, or schema changes.

## Design

### Both hooks — active-set extension

```ts
// Realtime statuses that mean "still running" — queued + executing.
// Everything else terminal is either COMPLETED (success) or a failure
// variant handled as an error. Queued names per the SDK zod `RunStatus`
// schema plus the `runStream.js` queued list; legacy
// WAITING_FOR_DEPLOY/REATTEMPTING/FROZEN kept for compat.
const REALTIME_ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "PENDING_VERSION",
  "WAITING_FOR_DEPLOY",
  "WAITING",
  "QUEUED",
  "DEQUEUED",
  "PENDING",
  "EXECUTING",
  "REATTEMPTING",
  "FROZEN",
  "DELAYED",
]);
```

Identical literal in both files (existing duplication kept on purpose).
No logic change: the `has()` early-return already does the right thing
once the names are present — `isActive`/`isGenerating` stay true,
subscription stays up, `AI_STATUS`/terminal path proceeds normally.

### `docs/troubleshooting.md` — prod checklist

Replace the `Run never starts` line with:

```md
- Run stuck in `PENDING_VERSION` (design sidebar shows
  `Design run ended (PENDING_VERSION)`, spec shows the spec variant):
  Trigger Cloud has the run but no deployed worker provides that task
  version. Check the dashboard Runs page, then: (1) deploy the worker
  (`trigger deploy`, same `TRIGGER_PROJECT_REF` as the app), (2) set task
  env (`LIVEBLOCKS_SECRET_KEY`, `GROQ_API_KEY`, `TRIGGER_SECRET_KEY`) on
  the Trigger Cloud project — not just Vercel, (3) keep SDK/CLI pinned to
  `4.5.16`. Locally this state never appears because `trigger:dev`
  provides the worker.
```

## Verification

- `bunx next typegen` → `bun run typecheck` → `bun run lint` →
  `bun run fmt` (touched files) → `bun run build` clean.
- Code-read check: with worker down, `realtimeStatus ===
"PENDING_VERSION"` now returns early in both backstops (no teardown, no
  Ghost error); with worker up, flow is unchanged (AI_STATUS path +
  COMPLETED backstop intact).
- No live Trigger run needed: the change is a pure status-classification
  fix; the live matrix (worker up/down) remains a manual follow-up.

## Risks

- **Masking a truly-stuck run** — `PENDING_VERSION` with no worker now
  shows working indefinitely (design hook has no absolute timeout; spec
  hook has its 6-min ceiling). Accepted per spec: the previous behavior
  (instant false error + torn-down subscription) was strictly worse — it
  made recovery impossible even after the worker came up.
- **Future status renames** — if Trigger adds another queued name, it
  falls back to the false-terminal. Mitigated by citing both sources in
  the comment so the next reader knows where to check.
