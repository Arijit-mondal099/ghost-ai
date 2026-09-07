Add Trigger.dev to Ghost AI so AI architecture generation and spec generation can run as durable background tasks instead of inside request handlers (`architecture-context.md` invariant 1).

## What to Install

- `@trigger.dev/sdk` (runtime dependency)
- `@trigger.dev/build` (dev dependency)
- Pin both to the same version as the `trigger.dev` CLI.

## Implementation

1. Create `trigger.config.ts` in the project root.
   - `project` ref comes from the Trigger.dev dashboard (`proj_...`).
   - `dirs` points at `./trigger` (matches the `trigger` system boundary in `architecture-context.md`; the repo has no `src/` directory).
   - Keep default retries; no Bun runtime override, no build extensions yet.

2. Add the first task in the `trigger/` directory.
   - Export a named `hello-world` task as the registration smoke test.
   - Future AI design-generation and spec-generation tasks will live alongside it.

3. Wire `tsconfig.json` and `.gitignore`.
   - Add `trigger.config.ts` to the tsconfig `include` array.
   - Add `.trigger` (CLI local dev state) to `.gitignore`.

4. Set the secret key.
   - `TRIGGER_SECRET_KEY` (DEV key from the dashboard API Keys page) in `.env.local`.
   - Self-hosted setups also need `TRIGGER_API_URL`.
   - Never commit the key.

5. Run the dev server.
   - `npx trigger.dev@latest dev` (requires `trigger login` first).
   - Confirm the `hello-world` task registers in the dashboard.

## Triggering Pattern (for future tasks)

- Trigger by id with a type-only import so task code is never bundled into the app:

```ts
import { tasks } from "@trigger.dev/sdk";
import type { helloWorld } from "@/trigger/example";

const handle = await tasks.trigger<typeof helloWorld>("hello-world", { name: "Ada" });
```

## Check When Done

- `@trigger.dev/sdk` + `@trigger.dev/build` installed at matching versions.
- `trigger.config.ts` points at the dashboard project ref with `dirs: ["./trigger"]`.
- At least one exported task exists under `trigger/`.
- `trigger dev` registers the task in the dashboard.
- `TRIGGER_SECRET_KEY` is set where triggering code runs.
- `bun run build` passes.
