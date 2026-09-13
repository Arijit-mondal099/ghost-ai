# 40 — PENDING_VERSION misclassified as terminal run failure

## Problem

In production, submitting a design prompt ends almost immediately with:

> `Ghost · Design run ended (PENDING_VERSION). Try again.`

`PENDING_VERSION` is a Trigger.dev queued status (run accepted, waiting for
a worker/version that provides the task), not a terminal failure. Both
client hooks omit it (plus `WAITING` / `DEQUEUED` / `PENDING`) from
`REALTIME_ACTIVE_STATUSES`, so the realtime backstop treats any of them as
a failure variant: it tears down `runId`/`publicToken`, posts a Ghost error,
and unsubscribes before the worker ever picks the run up.

Current sets (verified):

- `hooks/use-design-agent.ts:67-74` —
  `WAITING_FOR_DEPLOY, QUEUED, EXECUTING, REATTEMPTING, FROZEN, DELAYED`
- `hooks/use-spec-generation.ts:63-70` — same set

Authoritative enum (`node_modules/@trigger.dev/core/.../schemas/api`):
`PENDING_VERSION, QUEUED, DEQUEUED, EXECUTING, WAITING, COMPLETED,
CANCELED, FAILED, CRASHED, SYSTEM_FAILURE, DELAYED, EXPIRED, TIMED_OUT`,
and the realtime stream treats
`PENDING_VERSION, QUEUED, PENDING, DELAYED` as queued
(`core/.../apiClient/runStream.js`). The pinned `run-object.mdx` doc the
hooks cite is stale (lists `WAITING_FOR_DEPLOY`, omits the new names).

Second half is deploy: locally `bun run trigger:dev` provides the worker;
in prod no worker means runs sit in `PENDING_VERSION` forever
(`docs/troubleshooting.md` already notes this). The code fix stops the
false-terminal; the human still must deploy the worker.

## Implementation

1. `hooks/use-design-agent.ts` + `hooks/use-spec-generation.ts` — extend
   `REALTIME_ACTIVE_STATUSES` with the queued statuses the API actually
   emits: `PENDING_VERSION`, `WAITING`, `DEQUEUED`, `PENDING`. Keep all six
   existing entries (`WAITING_FOR_DEPLOY`, `REATTEMPTING`, `FROZEN` are
   legacy but harmless). Update the above comment to cite the zod schema +
   `runStream.js` queued list instead of only `run-object.mdx`.
2. `docs/troubleshooting.md` — extend the `Run never starts` entry: name
   `PENDING_VERSION` explicitly (queued-for-worker, check dashboard Runs
   page), prod checklist (worker deployed, same `TRIGGER_PROJECT_REF`,
   task env vars set on Trigger Cloud, SDK/CLI pinned to `4.5.16`).

## Scope Limits

- No API route, Trigger task, Liveblocks, Blob, Prisma, or schema changes.
- No new timeout/exit behavior: `PENDING_VERSION` simply stays in the
  active union (`isActive` / `isGenerating`). Spec-gen keeps its 6-minute
  absolute timeout; design-agent keeps its current no-timeout behavior.
- No shared-constant extraction: both hook files keep their local set
  (matches existing duplication, smallest diff).
- No change to terminal handling: `COMPLETED` success path and all other
  failure variants behave exactly as today.

## Check When Done

- Prompt with worker up: no `ended (PENDING_VERSION)` message; run
  proceeds via `AI_STATUS` as before.
- Prompt with worker down: UI stays on working/Generating (active), not
  the false-terminal error, until the real terminal/timeout arrives.
- `bunx next typegen`, `bun run typecheck`, `bun run lint`,
  `bun run fmt` (touched files), and `bun run build` pass.
