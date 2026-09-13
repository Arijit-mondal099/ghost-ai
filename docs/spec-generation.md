# Spec Generation

Converts the current canvas graph (+ chat history) into a persisted Markdown technical spec.

## Trigger

- `POST /api/ai/spec` — body `{ roomId, chatHistory, nodes, edges }` (`parseSpecTriggerBody`). `projectId` is derived from `roomId` server-side to avoid IDOR. Guards: `requireUserId()` → Upstash `ai` ratelimit → access check. Returns `{ runId }`.
- `POST /api/ai/spec/token` — run-scoped public token like the design route but `expirationTime: 1hr` (spec runs are longer).

Client: `hooks/use-spec-generation.ts` (trigger + `useRealtimeRun` progress) → `components/ai-sidebar/specs-tab.tsx` (Generate button) + `spec-progress.tsx` (progress bar) + `spec-preview-dialog.tsx` (Markdown preview via `react-markdown` + `remark-gfm`, save/download).

## Task: `generate-spec` (`trigger/generate-spec.ts`)

Payload `{ projectId, roomId, chatHistory: [{ role, content }], nodes: unknown[], edges: unknown[] }` → `{ ok, markdown } | { ok: false, error }`.

1. Validate + enforce graph caps (200 nodes / 400 edges — reject, don't truncate).
2. `metadata.set(status: generating, progress: 0.1)`.
3. Call Groq Markdown (same `qwen/qwen3.6-27b`; `max_tokens: resolveMaxTokens()`, default `1000`, env `GROQ_SPEC_MAX_TOKENS` `256–32000`).
4. `length`-truncation fallback: retry once in compact mode (<700 words, 60s heartbeat).
5. `metadata(status: complete, progress: 1.0)`.

Markdown rides the task output; **persistence is a separate client step** (keeps the task pure generation).

## Persistence

- `POST /api/projects/[projectId]/specs` — body `{ markdown }`. Writes Blob `specs/{projectId}/{specId}.md` (private store) + `ProjectSpec { filePath }` row. Returns `201` (no URL exposed).
- `GET .../specs` — lists `{ id, createdAt }` metadata only.
- `GET .../specs/[specId]/download` — gated download as Markdown attachment via Blob `get()` on the deterministic pathname.
- UI: `hooks/use-project-specs.ts` lists + downloads; `specs-tab.tsx` shows spec cards.

No versioned history / review workflows (out of scope) — each generation is a new `ProjectSpec` row.
