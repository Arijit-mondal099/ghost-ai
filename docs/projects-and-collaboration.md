# Projects & Collaboration

## Project lifecycle

- `GET /api/projects` — lists owned projects (`ownerId = userId`, `orderBy createdAt desc`, `Cache-Control: no-store`). Returns `{ projects: [...] }` (empty array, not 404, for new users).
- `POST /api/projects` — body `{ name?, description? }` (allow-list validated, name trimmed 1–120 chars, default `"Untitled Project"`). Enforces plan limits (`lib/billing.ts`: `free: 3`, `pro: 100`, `pro_max: 1000`, Clerk `has({plan})` is source of truth; exceeding returns `402 PLAN_LIMIT` → `UpgradePlanDialog`). Returns `201` + `Location: /api/projects/{id}`.
- `PATCH /api/projects/[projectId]` — owner only. Rename via `parseRenameProjectBody`. Find-then-mutate so missing → `404`, non-owner → `403`.
- `DELETE /api/projects/[projectId]` — owner only. Cascades collaborators/taskRuns/specs (Prisma `onDelete: Cascade`), bumps `access` cache version, returns `204`.

UI: `app/editor/page.tsx` (server) → `getProjectsForCurrentUser()` (`lib/projects-data.ts`) → `EditorHomeClient` + `useProjectActions` (`hooks/use-project-actions.ts`) → dialogs `create/rename/delete-project-dialog.tsx` + `project-sidebar.tsx` / `project-item.tsx`. Creating navigates to `/editor/{id}`; rename/delete call `router.refresh()`.

`roomId` in `/editor/[roomId]` **is** `Project.id` — no separate room table.

## Sharing

Dialog: `components/editor/share-project-dialog.tsx` + `hooks/use-share-dialog.ts`.

- `GET /api/projects/[projectId]/collaborators` — owner **or** collaborator. Returns `{ owner, collaborators }` enriched with Clerk profiles (`lib/clerk-users.ts`: `enrichCollaborators`; miss → `{ email, name: null, imageUrl: null }` fallback row). `no-store`.
- `POST .../collaborators` — owner only. Body `{ email }` (trimmed, lowercased, regex-checked). Pre-checks `findUserByEmail` → `400 USER_NOT_FOUND` on miss; `create` → `409 ALREADY_COLLABORATOR` on `P2002`. Returns `201` + `Location`.
- `DELETE .../collaborators/[collaboratorId]` — owner only. `deleteMany({ where: { id, projectId } })` → `count 0` = `404`, else `204`.

Invite requires a Clerk account with that email (exact case-insensitive match on `emailAddresses[]`). The share dialog shows a copy-link row (hydrated from `window.location.href`), a read-only banner for non-owners, an owner row with `Owner` badge, and a `You` badge matched on current email.

## Billing limits

`lib/billing.ts` maps Clerk plans to project caps. The create route checks before inserting; the editor surfaces `upgrade-plan-dialog.tsx` on `402`. Pricing page (`app/pricing/`) mirrors these tiers.
