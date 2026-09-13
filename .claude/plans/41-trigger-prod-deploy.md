# Plan: 41 Deploy the Trigger.dev worker to Production

## Context

Spec `.claude/context/specs/41-trigger-prod-deploy.md`. Dashboard
screenshot shows a Production `design-agent` run parked in `Pending
version` with an intact payload and no logs — the trigger path works, no
worker version exists in Production.

**Current state (verified):**

- `trigger.config.ts:3-8` — `project: process.env.TRIGGER_PROJECT_REF!`
  with a TODO to replace it with the dashboard ref. Resolves at deploy
  time only if the var is exported in that shell.
- `package.json:9` — `"trigger:dev": "bunx trigger.dev@4.5.16 dev"`,
  no deploy script. SDK/build/hooks all pinned `4.5.16` (`:30-31,57`).
- `.env.local` holds `TRIGGER_PROJECT_REF=proj_fdxdszhltdgtrgaykswl`
  (public `proj_` identifier — committable, per Trigger docs).
- `trigger/` contains exactly `design-agent.ts` + `generate-spec.ts`;
  grep confirms neither imports `@/` (both headers document the
  self-containment for the Trigger bundle), so no bundling changes needed.
- No `.github/`, no `vercel.json`, `.trigger/` gitignored with only local
  dev artifacts (`tmp/`, `dev.lock`).
- `docs/deployment.md:20` already lists `trigger deploy` as checklist
  step 3 — the step was never executed, not missing from docs.

**Locked decision:** smallest repo diff that makes the manual deploy
reliable (literal ref + pinned script). No CI workflow yet — prove the
manual path first.

## Files to Create

None.

## Files to Modify

1. `trigger.config.ts` — literal project ref, TODO removed:
   ```ts
   export default defineConfig({
     // Project ref from the Trigger.dev dashboard (public identifier,
     // not a secret). Dev/prod are environments inside this one project,
     // so the literal is correct for `trigger:dev` and `trigger:deploy`.
     project: "proj_fdxdszhltdgtrgaykswl",
     // ...rest unchanged
   });
   ```
2. `package.json` — add after `trigger:dev`:
   `"trigger:deploy": "bunx trigger.dev@4.5.16 deploy"`.
3. `docs/configuration.md` — Trigger.dev bullet becomes:
   `trigger.config.ts` → literal `project: "proj_fdxdszhltdgtrgaykswl`,
   `dirs: ["trigger"]`, same retry notes. Deploy via
   `bun run trigger:deploy` (was: `bun run trigger:dev` locally).
4. `.claude/context/progress-tracker.md` — record implementation state.

## Design

Why the literal ref: `trigger deploy` evaluates `trigger.config.ts` in
the deploy shell. With the `!`-asserted env var, a missing export yields
`undefined` and the failure surfaces late (version mismatch / project
not found) instead of at config load. The literal removes the entire
class. Runtime behavior is identical — `TRIGGER_PROJECT_REF` stays in
`.env.local`/Vercel for the app-side `tasks.trigger` path, which already
works (proven by the pending run existing in Production).

Why no workflow: the repo has no `.github/` at all; introducing Actions

- Trigger deploy tokens is a second auth surface to get wrong. Manual
  `bun run trigger:deploy` from `main` after this change is the shortest
  path to a Production worker; GitHub auto-deploy is the follow-up.

## Verification

- `bunx next typegen` → `bun run typecheck` (covers `trigger.config.ts`
  via tsconfig include) → `bun run lint` → `bun run fmt` (touched files)
  → `bun run build` clean.
- Human follow-up (dashboard, not headless): deploy, confirm both tasks
  in `Deploys`, set Production `GROQ_API_KEY` + `LIVEBLOCKS_SECRET_KEY`
  on the Trigger Cloud project, cancel the stuck run, re-prompt.

## Risks

- **Ref churn** — if the Trigger project is ever recreated, the literal
  must be updated in one place (`trigger.config.ts` + this plan's docs
  line). Accepted: single source, grep-able, and a recreated project
  already requires re-keying every env var anyway.
- **Deploy still manual** — nothing in this change puts a worker in
  Production by itself; it only removes the repo-side footguns. The
  human deploy step is explicit in the spec and the final summary.
