# Plan: 23 Design Agent API — Trigger Route, TaskRun Tracking, Token Route, Minimal Task

## Context

Spec `.claude/context/specs/23-design-agent-api.md` wires the backend flow for
design generation. No AI logic, no nodes/edges, no canvas writes — only task
triggering, run tracking, and scoped token issuance.

**Current state:**

- `trigger.config.ts` uses `process.env.TRIGGER_PROJECT_REF!`, `dirs: ["trigger"]`.
- `trigger/example.ts` exports `hello-world` via `task()` — the pattern to copy.
- `@trigger.dev/sdk@4.5.16` + `@trigger.dev/react-hooks` installed; `tsconfig`
  includes `trigger.config.ts`; `.gitignore` has `.trigger`.
- No `TaskRun` model; no `app/api/ai/*` routes; no design task.
- API conventions: `requireUserId()` + hand-rolled validators + `{ error }`
  envelope; `roomId === Project.id` (spec 08); owner OR collaborator gate.

**Approved decisions (user said "go ahead" on the proposed plan):**

- `TaskRun` gets FK to `Project` with `onDelete: Cascade` (extra vs spec text,
  keeps deletes clean).
- Trigger body `{ prompt, projectId, roomId? }` — `roomId` defaults to
  `projectId`.
- Token gate is spec-literal (requester === triggering `userId`) plus a
  project-access recheck.
- Project-access miss on trigger route → 404 (canvas-route precedent).

## Files to Create

```
prisma/models/task-run.prisma      # TaskRun model
trigger/design-agent.ts            # minimal design-agent task
app/api/ai/design/route.ts         # POST trigger
app/api/ai/design/token/route.ts   # POST token
```

## Files to Modify

1. `prisma/models/project.prisma` — add `taskRuns TaskRun[]` back-relation.
2. `lib/api/validation.ts` — append `parseDesignTriggerBody`,
   `parseDesignTokenBody`.
3. `.claude/context/progress-tracker.md` — record implementation state.

Plus generated: `prisma/migrations/*_add_task_run/`, `app/generated/prisma/`.

No `trigger.config.ts`, `trigger/example.ts`, `proxy.ts`, `globals.css`,
`components/ui/*` change.

## Design

### TaskRun (`prisma/models/task-run.prisma`)

```prisma
model TaskRun {
  id        String   @id @default(cuid())
  runId     String   @unique
  projectId String
  userId    String
  createdAt DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([runId])
  @@index([userId, projectId])
}
```

Migration: `bunx prisma migrate dev --name add_task_run`, then
`bunx prisma generate` (migrate does not auto-generate — spec 05 lesson).

### Validators

- `parseDesignTriggerBody`: allow-list `["prompt","projectId","roomId"]`;
  `prompt` trimmed 1–4000 chars; `projectId` trimmed non-empty; `roomId`
  optional, defaults to `projectId`.
- `parseDesignTokenBody`: allow-list `["runId"]`; `runId` trimmed non-empty.

### Task (`trigger/design-agent.ts`)

```ts
import { task } from "@trigger.dev/sdk";

export const designAgent = task({
  id: "design-agent",
  run: async (payload: { prompt: string; roomId: string; projectId: string }) => {
    console.log("[design-agent]", payload);
    return { ok: true, echo: payload };
  },
});
```

Plain `task()` (no Zod dep). Return is JSON-serializable.

### POST /api/ai/design

Parse JSON → `requireUserId()` → `parseDesignTriggerBody` → project access
(owner OR collaborator, `findFirst` + `OR`; miss → 404) →
`tasks.trigger<typeof designAgent>("design-agent", { prompt, roomId, projectId })`
(type-only import, never the instance) → `prisma.taskRun.create(...)` →
`201 { runId }` + `Cache-Control: no-store`. Trigger SDK failure → 502
`TRIGGER_UNAVAILABLE`, no row written.

### POST /api/ai/design/token

Parse JSON → `requireUserId()` → `parseDesignTokenBody` →
`findUnique({ where: { runId } })` → miss → 404; `userId` mismatch → 403 →
project-access recheck on `taskRun.projectId` → 404 on loss →
`auth.createPublicToken({ scopes: { read: { runs: [runId] } } })` →
`{ token }` + `no-store`. Scopeless tokens 403 on subscribe, so scope is
mandatory.

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt:check` (new files) →
  `prisma validate` + `migrate status` → `build`.
- Live (needs `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`, `trigger dev`):
  trigger → `runId` + DB row; token → scoped token; wrong user → 403;
  bad id → 404.

## Risks

- **Trigger creds absent in CI**: `tasks.trigger` throws without
  `TRIGGER_SECRET_KEY`; surfaced as 502, build still passes (no top-level
  trigger call at import time).
- **`runId` unknown to Trigger.dev on token mint**: `createPublicToken`
  scopes by string id without existence check — token issues fine, subscribe
  fails later; acceptable for wiring-only spec.
- **Spec-literal token gate**: collaborators of the project who did not trigger
  get 403; intended per spec, revisit if shared-run viewing is needed.
