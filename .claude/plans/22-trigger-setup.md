# Plan: 22 Trigger.dev Setup — SDK, Config, First Task

## Context

Spec `.claude/context/specs/22-trigger-setup.md` adds the Trigger.dev foundation
so future AI design-generation and spec-generation work has a durable-task home.
`architecture-context.md` already names Trigger.dev as the background-tasks layer
with the `trigger` system boundary; no `src/` directory exists, so `dirs` is
`./trigger`.

**Current state:**

- `package.json` has no `@trigger.dev/*` deps; no `trigger.config.ts`; no
  `trigger/` directory.
- `tsconfig.json` `include` covers `**/*.ts` but does not list
  `trigger.config.ts` explicitly (skill requirement).
- `.gitignore` ignores `.env*` (so the secret key stays uncommitted) but not
  `.trigger` (CLI local dev state).
- CLI `4.5.16` verified available via `bunx trigger.dev@latest --version`;
  `bun 1.3.14`, `node v24.12.0`.
- Human-only steps (cannot be done headlessly): `trigger login` browser auth +
  dashboard project ref (`proj_...`) + DEV `TRIGGER_SECRET_KEY`.

**Approved decisions:**

- `dirs: ["./trigger"]` — matches the architecture boundary, no `src/` layout.
- No `runtime: "bun"` override (default Node worker; avoids Vercel/deploy
  surprises). Revisit if tasks need Bun-specific APIs.
- No build extensions (`prismaExtension`, etc.) yet — added when real AI tasks
  land.
- First task is a `hello-world` smoke test only; no AI logic in this spec.

## Files to Create

```
trigger.config.ts      # defineConfig({ project, dirs: ["./trigger"], ... })
trigger/example.ts     # export const helloWorld = task({ id: "hello-world", ... })
```

## Files to Modify

1. `package.json` + `bun.lock` — `bun add @trigger.dev/sdk@4.5.16`,
   `bun add -d @trigger.dev/build@4.5.16` (pinned to CLI version).
2. `tsconfig.json` — add `trigger.config.ts` to `include`.
3. `.gitignore` — append `.trigger`.
4. `.claude/context/progress-tracker.md` — record setup state + human handoffs.

No `prisma/`, `proxy.ts`, `app/api/`, `globals.css`, or `components/ui/*` change.
No `TRIGGER_SECRET_KEY` written by the agent (human pastes it into `.env.local`).

## Design

### Config (`trigger.config.ts`)

```ts
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "<project ref>", // human fills from dashboard, e.g. "proj_abc123"
  dirs: ["./trigger"],
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      randomize: true,
    },
  },
});
```

Ships with the placeholder ref; the human replaces it after picking/creating
the dashboard project (or `npx trigger.dev@latest init` selects it
interactively once logged in).

### First task (`trigger/example.ts`)

```ts
import { task } from "@trigger.dev/sdk";

export const helloWorld = task({
  id: "hello-world",
  run: async (payload: { name: string }) => {
    return { message: `Hello ${payload.name}!` };
  },
});
```

Named export, project-unique `id`, inside a configured `dirs` path — the three
registration requirements.

## Verification

- `bun run typecheck` → `bun run lint` → `bun run fmt:check` (new files) →
  `bun run build` clean.
- Human runs `npx trigger.dev@latest login`, then
  `npx trigger.dev@latest dev`, and confirms `hello-world` appears in the
  dashboard test page.

## Risks

- **Placeholder project ref**: `trigger dev` will fail validation until the
  human fills in the real `proj_...` — expected, called out in the handoff.
- **CLI/SDK drift**: both `@trigger.dev/*` packages are pinned to the verified
  CLI version (`4.5.16`) to avoid the major-mismatch dev/deploy break.
- **Old import path**: all new code imports from `@trigger.dev/sdk` (never
  `@trigger.dev/sdk/v3`); tasks defined with `task()`, never
  `client.defineJob()`.
