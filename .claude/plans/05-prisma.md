# Spec 05 — Prisma Implementation Plan

## Context

The editor chrome (spec 02), Clerk auth (spec 03), and the project CRUD surface on mock data (spec 04) are all in place. `lib/projects.ts` carries a `Project` interface that mirrors the eventual Prisma model, and `hooks/use-project-dialogs.ts` is documented as the seam for the future swap. This spec stands up the **real database layer** — the two Prisma models, the cached client singleton, and the first migration — so that every later backend spec (Clerk-derived `ownerId` wiring, canvas membership, blob path persistence, API route handlers, background task persistence) has a schema to land in.

Scope is intentionally narrow: **schema + singleton + migration only.** No API routes, no `lib/projects.ts` rewiring, no Clerk integration in the hook, no seed data. The dialog hook and mock data stay untouched — downstream specs swap the bodies of `submitCreate` / `submitRename` / `submitConfirmDelete` for real Prisma mutations.

## Resolved Decisions

| Question                   | Decision                                                                                                                                                                 | Why                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema layout              | Multi-file: root `prisma/schema.prisma` holds only `generator` + `datasource`; models live in `prisma/models/project.prisma` (the file the spec names).                  | Prisma 7 multi-file schema — `schema: "prisma"` in `prisma.config.ts` recursively scans `*.prisma` under `prisma/`. The generator block must live in the root.                                                                  |
| ID strategy                | `cuid()` (string) for both models.                                                                                                                                       | Matches the existing `Project.id` type in `lib/projects.ts` (string IDs), so the future consumer swap is drop-in.                                                                                                               |
| `ownerId` type             | `String`. No FK.                                                                                                                                                         | No `User` model. Clerk user IDs are external opaque strings, not rows in our DB. Spec explicitly forbids extra fields.                                                                                                          |
| `canvasJsonPath`           | `String?`.                                                                                                                                                               | "for future canvas blob storage" — starts null, populated by the eventual canvas-write spec.                                                                                                                                    |
| `description`              | `String?`.                                                                                                                                                               | "optional description" per spec.                                                                                                                                                                                                |
| `status` enum              | `enum ProjectStatus { DRAFT, ARCHIVED }` declared in the same model file.                                                                                                | Spec says "status enum: DRAFT, ARCHIVED".                                                                                                                                                                                       |
| Timestamps                 | `Project`: `createdAt @default(now())` + `updatedAt @updatedAt`. `ProjectCollaborator`: `createdAt @default(now())` only.                                                | Spec says "timestamps" (plural) on `Project`, "creation timestamp" on `ProjectCollaborator`.                                                                                                                                    |
| Cascade                    | `@relation(fields: [projectId], references: [id], onDelete: Cascade)` on the collaborator side.                                                                          | Spec: "project relation with cascade delete". DB-level FK constraint, not just app-level.                                                                                                                                       |
| Indexes                    | `Project` → `@@index([ownerId])`, `@@index([createdAt])`. `ProjectCollaborator` → `@@unique([projectId, email])`, `@@index([email])`, `@@index([projectId, createdAt])`. | Verbatim from the spec.                                                                                                                                                                                                         |
| Singleton location         | `lib/prisma.ts`.                                                                                                                                                         | `lib/` is the home for shared infrastructure (Prisma client, auth helpers, utilities) per the architecture boundary in `.claude/context/architecture-context.md`.                                                               |
| Accelerate branch          | `new PrismaClient({ accelerateUrl: url }).$extends(withAccelerate())` when `DATABASE_URL` starts with `prisma+postgres://`.                                              | Verified in `references/accelerate-users.md` — the v7-correct pattern. `@prisma/adapter-pg` will NOT accept `prisma+postgres://` URLs (it expects direct `postgres://` connection strings).                                     |
| `pg` adapter branch        | `new PrismaPg({ connectionString: url })` + `new PrismaClient({ adapter })` for any other URL prefix.                                                                    | Verified in `references/driver-adapters.md` (PostgreSQL section).                                                                                                                                                               |
| Dev hot-reload cache       | `globalThis` pattern, typed via `interface GlobalForPrisma { prismaGlobal?: ReturnType<typeof createPrismaClient> }`.                                                    | Code-standards.md: "use `interface` for object contracts", "avoid `any`". Dropping the explicit return-type annotation (let TypeScript infer the union) avoids the `as unknown as` cast that the v7 driver-adapter skill shows. |
| Client import path         | `import { PrismaClient } from "../app/generated/prisma/client"`.                                                                                                         | The `prisma-client` generator's server entrypoint. Verified in upgrade skill step 6.                                                                                                                                            |
| Missing `DATABASE_URL`     | Throw at module load.                                                                                                                                                    | "Validate unknown external input at system boundaries" (code-standards.md). Silent defaults hide misconfig.                                                                                                                     |
| Local DB                   | User's `.env` points to `prisma+postgres://localhost:51213/...` — the `prisma dev` default. `prisma dev` must be running before any migration or first query.            | Without `prisma dev`, the Accelerate client fails to connect at module load. `prisma dev` provisions the local Postgres and the shadow database automatically.                                                                  |
| Accelerate package version | `@prisma/extension-accelerate@^3.0.1` (not `^7.8.0`).                                                                                                                    | The package has its own version track — `^7.8.0` does not resolve; the latest stable is `3.0.1`. API-compatible with Prisma 7.                                                                                                  |

## Files

### Create

- `prisma/models/project.prisma` — `ProjectStatus` enum + `Project` model (`id`, `ownerId`, `name`, `description?`, `status @default(DRAFT)`, `canvasJsonPath?`, `createdAt`, `updatedAt`, both indexes, `collaborators ProjectCollaborator[]`) + `ProjectCollaborator` model (`id`, `projectId`, `email`, `createdAt`, cascade relation to `Project`, `@@unique([projectId, email])`, both indexes).
- `lib/prisma.ts` — cached singleton. Imports `PrismaClient` from the generated client, `PrismaPg` from `@prisma/adapter-pg`, `withAccelerate` from `@prisma/extension-accelerate`. Throws if `DATABASE_URL` is missing. Branches on the `prisma+postgres://` prefix. Dev cache typed via `interface GlobalForPrisma`. Exports `prisma`.
- `prisma/migrations/<timestamp>_init_project_models/migration.sql` — auto-generated by `migrate dev`. Contains `CREATE TYPE "ProjectStatus"`, two `CREATE TABLE` statements (with `UNIQUE` and `ON DELETE CASCADE` constraints), all four indexes, and the cascade FK.

### Modify

- `prisma/schema.prisma` — slim the v6-era scaffold comments. Keep only `generator client { provider = "prisma-client", output = "../app/generated/prisma" }` and `datasource db { provider = "postgresql" }`. No `url` (the URL is read by `prisma.config.ts` from `DATABASE_URL`).
- `package.json` + `bun.lock` — add `@prisma/extension-accelerate@^3.0.1` to `dependencies`. The package's current stable is `3.0.1`; `^7.8.0` does not resolve.
- `.claude/context/progress-tracker.md` — add a "Spec 05 — Prisma data models, client singleton, first migration (commit pending)" entry under Completed, list the files and the dep add. Add an Open Question about the existing spec-numbering mismatch (the tracker currently labels spec 05 as the real-time canvas surface; the actual `05-prisma.md` is this spec). Update Current Phase / Current Goal to reflect that Prisma is done and the next step is wiring the dialog hook to Prisma + Clerk.

### No changes to

`prisma.config.ts` (already correct: `schema: "prisma"`, `migrations.path: "prisma/migrations"`, `datasource.url: process.env["DATABASE_URL"]`). `.env` / `.env.local` (`DATABASE_URL` already set). `lib/projects.ts`, `hooks/use-project-dialogs.ts`, `app/`, `components/`, `tsconfig.json`, `next.config.ts`, `components.json`. No `User` model. No `app/api/*` routes. No seed script. No Vercel Blob integration.

## Implementation Order (Dependency-Ordered)

1. **Install Accelerate extension**: `bun add @prisma/extension-accelerate@^3.0.1`.
2. **Start local Prisma Postgres** (must be running before any migration): `bunx prisma dev --detach`. The user's `.env` already points to `prisma+postgres://localhost:51213/...`, the `prisma dev` default. Subsequent commands reuse the running instance.
3. **Slim `prisma/schema.prisma`** to just the generator + datasource blocks.
4. **Write `prisma/models/project.prisma`** per the Decisions table.
5. **Run the migration**: `bunx prisma migrate dev --name init_project_models`. Then run `bunx prisma generate` as a separate step (this environment did not auto-generate).
6. **Write `lib/prisma.ts`** per the file-content block above.
7. **Update `progress-tracker.md`** (Completed entry, Open Question on numbering, Current Phase/Goal refresh).

## Critical Files

| File                                                  | Action | Why                                                                        |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| `prisma/models/project.prisma`                        | add    | the schema — load-bearing piece of the spec                                |
| `lib/prisma.ts`                                       | add    | the singleton every later spec will import                                 |
| `prisma/schema.prisma`                                | modify | slim to declarations only; multi-file schema is now active                 |
| `package.json` + `bun.lock`                           | modify | add `@prisma/extension-accelerate@^3.0.1`                                  |
| `.claude/context/progress-tracker.md`                 | modify | mark spec 05 complete, note the spec-numbering mismatch                    |
| `prisma/migrations/<timestamp>_init_project_models/*` | create | first migration, auto-generated by `migrate dev`                           |
| `app/generated/prisma/*`                              | create | generated client (gitignored by the existing `/app/generated/prisma` line) |

## Verification

```bash
bun run typecheck   # tsc --noEmit — singleton imports resolve, generated types valid
bun run lint        # oxlint — no warnings on new files
bun run fmt:check   # formatting clean
bun run build       # next build — spec's headline done-criterion
```

Then open `bunx prisma studio` (or query `prisma db execute` against the dev DB) and confirm both `Project` and `ProjectCollaborator` tables are present, with the `ProjectStatus` enum visible.

Spec done-criteria checklist:

- [x] Schema has both models with correct relations and indexes — verified in `migration.sql` and Studio
- [x] `lib/prisma.ts` exports one cached Prisma instance — verified by build + `import { prisma } from "@/lib/prisma"` resolving
- [x] Migration runs successfully — verified by `prisma/migrations/<timestamp>_init_project_models/migration.sql` existing
- [x] `bun run build` passes — verified by build

## Risks & Follow-ups

- **The `prisma+postgres://` branch is the only one exercised locally.** The user's `.env` is the `prisma dev` URL. If `prisma dev` is not running, the singleton will throw at module load. `prisma dev` is left running for the rest of the session; downstream specs that import `prisma` will hit the same prerequisite.
- **`bunx prisma migrate dev` did not auto-run `prisma generate` in this environment.** Future specs that depend on freshly added models should run both commands (or chain them).
- **Generated client lives under `app/`.** Gitignored, but a clean checkout in CI needs `bunx prisma generate` before `bun run build`. Out of scope to wire that into a script here; flag in the progress tracker if desired.
- **The progress-tracker's "Next Up" describes the real-time canvas surface and labels it spec 05** — a numbering mismatch with the actual `05-prisma.md`. Not fixed in this PR; noted as an Open Question for a follow-up.
- **Spec-numbering mismatch resolution is out of scope.** The real-time canvas surface (Liveblocks + React Flow) is presumably a later spec number that hasn't been written yet; the next actual unit of work is wiring `hooks/use-project-dialogs.ts` to the new Prisma client + `auth()` (replace `mockProjects` with `prisma.project.findMany`, derive `ownerId` from Clerk, swap the three `submit*` bodies for Prisma mutations, add `app/api/projects` route handlers).
