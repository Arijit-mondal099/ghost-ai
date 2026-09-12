# Database

Prisma 7 + PostgreSQL (Neon). Datasource `provider = "postgresql"`. Generator `prisma-client`, output `../app/generated/prisma` (gitignored). Models split across `prisma/models/`. Config in `prisma.config.ts`. Singleton in `lib/prisma.ts` (direct-TCP `@prisma/adapter-pg`, `globalThis` hot-reload cache).

## `Project` (`prisma/models/project.prisma`)

| Field                                  | Type                            | Notes                                       |
| -------------------------------------- | ------------------------------- | ------------------------------------------- |
| `id`                                   | `String @id @default(cuid())`   | Also used as Liveblocks `roomId`            |
| `ownerId`                              | `String`                        | Clerk `userId`, not an FK (no `User` model) |
| `name`                                 | `String`                        | 1–120 chars enforced at API layer           |
| `description`                          | `String?`                       | Optional                                    |
| `status`                               | `ProjectStatus @default(DRAFT)` | `DRAFT \| ARCHIVED`                         |
| `canvasJsonPath`                       | `String?`                       | Blob URL reference only                     |
| `createdAt` / `updatedAt`              | `DateTime`                      |                                             |
| `collaborators` / `taskRuns` / `specs` | relations                       | Cascade deletes                             |

Indexes: `[ownerId]`, `[createdAt]`.

## `ProjectCollaborator`

| Field       | Type                          | Notes                                      |
| ----------- | ----------------------------- | ------------------------------------------ |
| `id`        | `String @id @default(cuid())` | Used as `[collaboratorId]` in DELETE route |
| `projectId` | FK → `Project`                | `onDelete: Cascade`                        |
| `email`     | `String`                      | Lowercased invite email                    |
| `createdAt` | `DateTime`                    |                                            |

`@@unique([projectId, email])`; indexes `[email]`, `[projectId, createdAt]`.

## `ProjectSpec` (`prisma/models/project-spec.prisma`)

| Field       | Type                          | Notes                                      |
| ----------- | ----------------------------- | ------------------------------------------ |
| `id`        | `String @id @default(cuid())` | Used as `[specId]`; Blob filename          |
| `projectId` | FK → `Project`                | `onDelete: Cascade`                        |
| `filePath`  | `String`                      | Blob URL (`specs/{projectId}/{specId}.md`) |
| `createdAt` | `DateTime`                    |                                            |

Index `[projectId, createdAt]`.

## `TaskRun` (`prisma/models/task-run.prisma`)

| Field       | Type                          | Notes               |
| ----------- | ----------------------------- | ------------------- |
| `id`        | `String @id @default(cuid())` | Local row id        |
| `runId`     | `String @unique`              | Trigger.dev run id  |
| `projectId` | FK → `Project`                | `onDelete: Cascade` |
| `userId`    | `String`                      | Clerk requester     |
| `createdAt` | `DateTime`                    |                     |

Indexes `[runId]`, `[userId, projectId]`.

## Migrations

```bash
bunx prisma migrate status   # check against DATABASE_URL
bunx prisma migrate deploy   # apply (Neon / prod)
bunx prisma migrate dev --name <name>  # local authoring only
```

If `/editor` 500s with `P2021` (table missing), a migration hasn't been applied to the target DB — re-run `status`/`deploy` against that `DATABASE_URL`.
