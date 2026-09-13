# API Reference

Base: same origin. Auth: Clerk session cookie. Errors: `{ error: { code, message } }`. All routes apply `requireUserId()` (401) + relevant access checks; AI/project writes also pass the Upstash `ai` ratelimit (429).

## Projects

### `GET /api/projects`

List owned projects. → `200 { projects: [{ id, name, ... }] }` (`no-store`).

### `POST /api/projects`

Create. Body `{ name?, description? }` (unknown fields rejected; name 1–120 chars, default `"Untitled Project"`).
→ `201` project + `Location: /api/projects/{id}`. Over plan cap → `402 PLAN_LIMIT`.

### `PATCH /api/projects/[projectId]`

Rename (owner only). → `200` project. Missing → `404`, non-owner → `403`.

### `DELETE /api/projects/[projectId]`

Delete (owner only, cascades collaborators/taskRuns/specs). → `204`. Missing → `404`, non-owner → `403`.

## Canvas persistence

### `PUT /api/projects/[projectId]/canvas`

Persist canvas JSON → Blob `canvas/{projectId}.json`. Owner or collaborator. → `200`.

### `GET /api/projects/[projectId]/canvas`

Load canvas JSON via Blob `get()`. Owner or collaborator. → `200 { nodes, edges, ... }`.

## Realtime auth

### `POST /api/liveblocks-auth`

Body `{ room }` (Liveblocks SDK wire field, surfaced as `roomId`). Verifies `getAccessibleProject` (fail → `403`), ensures room (`defaultAccesses: ["room:write"]`, failure → `502 LIVEBLOCKS_UNAVAILABLE`), returns Liveblocks session with `{ name, avatar, color }`. `no-store`.

## Collaborators

### `GET /api/projects/[projectId]/collaborators`

Owner or collaborator. → `200 { owner, collaborators }` (Clerk-enriched; miss → `{ email, name: null, imageUrl: null }`).

### `POST /api/projects/[projectId]/collaborators`

Owner only. Body `{ email }` (trim/lowercase/regex). → `201` + `Location`. Unknown user → `400 USER_NOT_FOUND`; duplicate → `409 ALREADY_COLLABORATOR`.

### `DELETE /api/projects/[projectId]/collaborators/[collaboratorId]`

Owner only. → `204`; `count 0` → `404`.

## AI

### `POST /api/ai/design`

Body `{ prompt, roomId }`. Triggers `design-agent`, writes `TaskRun`. → `200 { runId }`.

### `POST /api/ai/design/token`

Body `{ runId }`. TaskRun-ownership + project-access checks. → run-scoped public token (`read: { runs: [runId] }`, ~15 min).

### `POST /api/ai/spec`

Body `{ roomId, chatHistory, nodes, edges }` (`projectId` derived from `roomId`). Triggers `generate-spec`. → `200 { runId }`.

### `POST /api/ai/spec/token`

Same as design token with `expirationTime: 1hr`.

### `POST /api/ai/chat/assistant`

Server Ghost `AI_CHAT` broadcast (TaskRun-gated). → `201 { id }`.

## Specs

### `POST /api/projects/[projectId]/specs`

Body `{ markdown }`. Blob `specs/{projectId}/{specId}.md` + `ProjectSpec` row. → `201` (no URL).

### `GET /api/projects/[projectId]/specs`

→ `200 { specs: [{ id, createdAt }] }`.

### `GET /api/projects/[projectId]/specs/[specId]/download`

→ Markdown attachment via Blob `get()`.

## Status codes

`200` ok · `201` created · `204` deleted · `400` bad body/email/user-not-found · `401` unauthenticated · `402` plan limit · `403` forbidden · `404` missing · `409` duplicate collaborator · `429` ratelimited · `502` Liveblocks unavailable.
