# 41 — Deploy the Trigger.dev worker to Production

## Problem

Production Trigger.dev runs for `design-agent` (and, by the same gap,
`generate-spec`) sit in `PENDING_VERSION` forever (dashboard screenshot:
`run_06g9kn9ubmi4p6xjvbc3nmam2l01`, payload intact, `Triggered 39s (TTL
14d)`, no logs). Trigger Cloud accepted the run — the app-side trigger
path (`POST /api/ai/design` → `tasks.trigger` → `TaskRun` row → token →
`useRealtimeRun`) works — but no worker version serving those tasks exists
in the Production environment, so there is nothing to pick the run up.
Locally this never happens because `bun run trigger:dev` provides the
worker for the Dev environment.

Repo-side deploy gaps (verified):

- `trigger.config.ts:7` still carries the spec-22 placeholder pattern:
  `project: process.env.TRIGGER_PROJECT_REF!` plus a TODO. If that env var
  is absent in the deploy shell, the config evaluates to `undefined` and
  the deploy fails cryptically. Dev/prod are environments inside one
  project, so a literal ref is correct for every deploy path (CLI +
  GitHub integration).
- `package.json` has `trigger:dev` (pinned `trigger.dev@4.5.16`) but no
  `trigger:deploy` script — the one command that creates the Production
  worker is undiscoverable from the repo.
- No `.github` workflow, no `vercel.json`, no Trigger extension config:
  deploys are manual CLI runs (documented in `docs/deployment.md:20`),
  which is why none ever happened.

## Implementation

1. `trigger.config.ts` — replace the env-var project ref + TODO with the
   literal `project: "proj_fdxdszhltdgtrgaykswl"` (public identifier, not
   a secret — this is exactly what Trigger docs commit). Nothing else in
   the config changes (`runtime`, `dirs`, `maxDuration`, retries stay).
2. `package.json` — add `"trigger:deploy": "bunx trigger.dev@4.5.16
deploy"` next to `trigger:dev` (pinned CLI, per the spec-22
   pin-everything lesson; `@latest` drift aborts deploys).
3. `docs/configuration.md` — update the Trigger.dev service note to the
   literal ref + the new script.
4. Human deploy (cannot be done headlessly — needs dashboard auth), in
   `docs/deployment.md` checklist order: `bun run trigger:deploy` from
   `main` (or connect the repo in dashboard Settings → GitHub for
   auto-deploys), set Production env vars on the Trigger Cloud project
   (`GROQ_API_KEY`, `LIVEBLOCKS_SECRET_KEY`; worker auth is automatic),
   confirm `Deploys` shows a Production deploy containing `design-agent`
   - `generate-spec`, cancel the stuck pending run, retry the todo-app
     prompt.

## Scope Limits

- No task-code changes (`trigger/design-agent.ts`, `trigger/generate-spec.ts`
  already avoid `@/` imports and bundle cleanly — verified by grep).
- No API route, hook, Liveblocks, Blob, Prisma, schema, or env-var
  additions. Vercel-side `TRIGGER_SECRET_KEY` must already be the
  **Production** key (the pending run landed in Production, so triggering
  is proven working — only the worker is missing).
- No GitHub Actions workflow: manual CLI deploy first; auto-deploy
  integration is a follow-up once the manual path is proven.
- No timeout/backoff changes to either hook (spec 40 already reclassified
  `PENDING_VERSION` as active; the UI now waits instead of false-erroring).

## Check When Done

- `bunx next typegen`, `bun run typecheck`, `bun run lint`,
  `bun run fmt` (touched files), and `bun run build` pass.
- After the human deploy: dashboard `Deploys` lists a Production deploy
  with both tasks; a fresh `Lets build todo app architecture.` prompt
  leaves `PENDING_VERSION` within seconds and completes via `AI_STATUS`.
