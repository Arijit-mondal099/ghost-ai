# Architecture

## Stack

| Layer              | Technology                                              | Role                                                           |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------------- |
| Framework          | Next.js 16 + TypeScript, React 19                       | Full-stack app with server/client boundaries                   |
| UI                 | Tailwind v4 + shadcn/ui (radix)                         | Component composition and styling                              |
| Auth               | Clerk (`@clerk/nextjs` 7.x)                             | Identity, route protection, user profiles                      |
| Database           | Prisma 7 + PostgreSQL (Neon)                            | Relational metadata: projects, collaborators, specs, task runs |
| Canvas             | Liveblocks 3.x + React Flow (`@xyflow/react` 12)        | Realtime shared graph, presence, cursors                       |
| Background tasks   | Trigger.dev 4.x                                         | Durable AI generation workflows                                |
| Artifact storage   | Vercel Blob (private store)                             | Canvas snapshots + Markdown specs                              |
| Rate limit / cache | Upstash Redis + Ratelimit                               | AI budget, `projects/collabs/specs/access` cache keys          |
| AI                 | Groq (`qwen/qwen3.6-27b`) + `groq-sdk`, Vercel `ai` SDK | Design ops + spec Markdown                                     |

## System boundaries

- `app/api` — authenticated handlers: validation, ownership checks, task triggering, persistence. Never runs long-lived AI work.
- `trigger/` — long-running jobs: `design-agent`, `generate-spec`. Only place that calls Groq + mutates Liveblocks storage server-side.
- `lib/` — shared infra: Prisma singleton, access control, Clerk helpers, billing, ratelimit, Liveblocks server client.
- `components/` — UI composition: canvas surfaces, sidebars, dialogs, landing/legal.
- `hooks/` — client realtime wiring: canvas mutations, AI run subscriptions, specs, share dialog.
- `prisma/` — schema + migrations; generated client at `app/generated/prisma/`.
- `types/` — `canvas.ts` (node colors/shapes), `tasks.ts` (AI feed payloads + guards).
- `data/` — legacy local directory. **Not used for new artifacts.**

## Storage model

- **PostgreSQL**: metadata only — `Project`, `ProjectCollaborator`, `ProjectSpec`, `TaskRun`. Blob URLs stored as references (`canvasJsonPath`, `filePath`).
- **Vercel Blob (private)**: artifacts — `canvas/{projectId}.json`, `specs/{projectId}/{specId}.md`. Never expose raw URLs; API reads via `get()` and streams gated downloads.
- **Liveblocks Storage**: live canvas graph (`flow` LiveObject with `nodes`/`edges` LiveMaps) + `aiStatus` LiveObject for AI presence replay.

## Request flow

```
Browser → proxy.ts (Clerk) → Server Component (getAccessibleProject)
  → RoomProvider (POST /api/liveblocks-auth mints token)
  → Canvas (useLiveblocksFlow) ⇄ Liveblocks cloud
  → AI prompt → POST /api/ai/design → Trigger.dev run
  → design-agent → Groq → mutateStorage(roomId) → AI_STATUS broadcast
  → Canvas updates live for all collaborators
  → Generate Spec → POST /api/ai/spec → generate-spec → Markdown in run output
  → POST /api/projects/{id}/specs → Blob + ProjectSpec row
```

## Invariants

1. Request handlers do not run long-lived AI work — that belongs in Trigger tasks.
2. Metadata (Postgres) and large artifacts (Blob) live in separate layers.
3. Auth + ownership enforced at every mutation boundary (`requireUserId` + `getAccessibleProject` + owner-only writes where specified).
4. Client components only where browser interactivity / realtime state requires them.
5. Canvas schema stays consistent between user content and imported templates (`types/canvas.ts` is the single source).
