# Plan: 29 Spec Generation Flow — Trigger Route, TaskRun Tracking, Token Route, Generate Task

## Context

Spec `.claude/context/specs/29-spec-generation-flow.md` wires the **backend only**
for AI-powered spec generation: API trigger route, Trigger.dev task, token route,
and run ownership tracking. No frontend logic, no spec editor UI, no spec
persistence in this unit.

**Current state:**

- `TaskRun` model exists (`prisma/models/task-run.prisma`, spec 23) — no
  migration needed, reuse it.
- `POST /api/ai/design` + `POST /api/ai/design/token` (spec 23) are the exact
  route templates: auth → access check → trigger/token → TaskRun row.
- `trigger/design-agent.ts` (spec 24) is the task template: Groq
  `qwen/qwen3.6-27b`, no JSON mode, retry/backoff, friendly errors, no `@/`
  imports in the trigger bundle, self-contained vocabularies.
- Validators are hand-rolled in `lib/api/validation.ts` (no Zod dep anywhere).
- `groq-sdk` is already a dependency; `@ai-sdk/google` is not installed.
- `auth.createPublicToken` supports `expirationTime` as a time-span string
  (`realtime/auth.mdx`: `expirationTime: "1hr"`, default 15 min).
- `metadata.set()` inside `run()` pushes realtime updates to `useRealtimeRun`
  subscribers (`runs/metadata.mdx`, `realtime/backend/subscribe.mdx`).

**Approved decisions (user, plan phase — deviations from spec text):**

- Hand-rolled validators, NOT Zod (matches specs 06/23/28, no new dep).
- Groq `qwen/qwen3.6-27b` reuse, NOT Gemini via `@ai-sdk/google` (no new dep,
  no new API key, proven retry/rate-limit handling; also honors the scope limit
  "do not create a new AI provider abstraction").
- Trigger `metadata` only for realtime status (no Liveblocks broadcast/Storage
  in this task — it needs only `GROQ_API_KEY`).

## Files to Create

```
trigger/generate-spec.ts          # generateSpec task (id "generate-spec")
app/api/ai/spec/route.ts          # POST trigger
app/api/ai/spec/token/route.ts    # POST token (1h expiry)
```

## Files to Modify

1. `lib/api/validation.ts` — append `parseSpecTriggerBody`,
   `parseSpecTokenBody`.
2. `.claude/context/progress-tracker.md` — record implementation state.

No `trigger.config.ts`, `prisma/`, `package.json`, `proxy.ts`, or UI changes.

## Design

### Validators (`lib/api/validation.ts`)

- `parseSpecTriggerBody`: allow-list `["roomId","chatHistory","nodes","edges"]`.
  `projectId` is rejected as an unknown field, enforcing "do not trust a
  client-supplied `projectId`" at the parse layer. `roomId` trimmed non-empty;
  `chatHistory` is an array (cap 50 entries) of
  `{ role: "user" | "assistant", content: 1–2000 chars }` (content cap reuses
  `AI_CHAT_CONTENT_MAX_LENGTH`); `nodes`/`edges` are arrays of
  `{ id: string, ... }` records with the 5 MB UTF-8 byte guard (same envelope
  check as `parseCanvasSaveBody` — internals stay opaque so canvas schema
  evolution never touches the API).
- `parseSpecTokenBody`: allow-list `["runId"]`, trimmed non-empty (mirrors
  `parseDesignTokenBody`).

### POST /api/ai/spec (`app/api/ai/spec/route.ts`)

`requireUserId()` → 401 → parse JSON (`INVALID_JSON` 400) →
`parseSpecTriggerBody` (400) → project access **derived from `roomId` only**
(`prisma.project.findFirst` with `id: roomId` + owner-OR-collaborator via
verified Clerk emails; miss → 404, collapsing 404+403 per canvas-route
precedent) → `projectId = roomId` (spec 08: `roomId === Project.id`) →
`tasks.trigger<typeof generateSpec>("generate-spec", { projectId, roomId,
chatHistory, nodes, edges })` (type-only import, task code never bundled into
the app) → `prisma.taskRun.create({ runId, projectId, userId })` →
`201 { runId }` + `Cache-Control: no-store`. Trigger SDK failure → 502
`TRIGGER_UNAVAILABLE`, no row. Persistence failure after a successful trigger
→ cancel the orphan via `runs.cancel` (best-effort) + 502, so the client
retries cleanly instead of tracking a run it can never observe (same
compensation as the design route).

### POST /api/ai/spec/token (`app/api/ai/spec/token/route.ts`)

Mirror of the design token route **plus** `expirationTime: "1hr"` (spec
requirement; the design route uses the 15-minute default). `requireUserId()` →
`parseSpecTokenBody` → `findUnique({ where: { runId } })` → miss → 404 →
`userId` mismatch → 403 → project-access recheck on `taskRun.projectId`
(removed collaborators lose access) → 404 on loss →
`auth.createPublicToken({ scopes: { read: { runs: [runId] } }, expirationTime:
"1hr" })` → `{ token }` + `no-store`. SDK failure → 502 `TOKEN_UNAVAILABLE`.

### Task (`trigger/generate-spec.ts`)

`task({ id: "generate-spec" })` with payload `{ projectId, roomId, chatHistory,
nodes, edges }`:

1. Defensive in-`run()` validation (direct triggers bypass the route) → return
   `{ ok: false, error }` on bad input.
2. Groq client from `GROQ_API_KEY` only (no Liveblocks import — metadata-only
   transport). System prompt frames a Markdown technical spec: overview,
   components (node labels with shape/color semantics), connections and data
   flow (edges + labels), rationale/open questions grounded in `chatHistory`.
   User message = compact node/edge serialization + chat history. No JSON
   extraction needed — output is Markdown, not ops.
3. `reasoning_effort: "none"` (spec 24 lesson: Qwen burns the token budget on
   `<think>` traces), temperature ~0.4, up to 3 attempts with backoff,
   fail-fast friendly message on 429 (per-minute quota can never be retried
   through). `max_tokens` sized for a full spec (larger than design-agent's
   1000 — see Risks).
4. Realtime: `metadata.set("status", "generating" | "complete" | "error")`
   (+ `progress`) inside `run()` — the future frontend reads it via
   `useRealtimeRun`. No `@/` imports (Trigger bundle constraint); minimal
   shape/color vocabulary duplicated like design-agent.
5. Returns `{ ok: true, markdown }` — plain Markdown task output, **not
   persisted** (out of scope for this unit).

Retries/logging/error handling mirror design-agent (`logger`, friendly
user-facing errors, raw provider detail never leaks).

## Verification

- `bunx next typegen` → `typecheck` → `lint` → `fmt:check` (new files) →
  `build` (expect 17 routes + Proxy). No migration to validate.
- Maps to spec's Check-When-Done: trigger validates input + returns `runId`;
  TaskRun row created for the authenticated user; token only for the run owner;
  task returns Markdown output; TypeScript + build pass.
- Live (needs `TRIGGER_SECRET_KEY` + `GROQ_API_KEY` in trigger env +
  `trigger dev`): trigger → `runId` + DB row; token → 1h scoped token; wrong
  user → 403; bad runId → 404; run completes with Markdown output in the
  dashboard; metadata stages update.

## Risks

- **Output-token budget vs spec length (main risk):** spec 24 hit a
  1000-OTPM tier ceiling forcing `max_tokens: 1000` — a full Markdown spec will
  not fit that. The plan sets a larger `max_tokens` and surfaces friendly 429
  errors, but a Groq tier bump may be required; flagged for the live test.
- **Token expiry string form:** `realtime/auth.mdx` uses `"1hr"`, ai-chat docs
  use `"1h"` — both are time-span strings; confirm at the live test.
- **Trigger payload size** for large canvases — bounded by the validator's
  5 MB guard; Trigger.dev payload limits are well above that.
