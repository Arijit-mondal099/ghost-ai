# Plan: Share Dialog (Spec 09)

## Context

The editor chrome (spec 02), auth (spec 03), project dialogs (spec 04), Prisma data model (spec 05), project CRUD APIs (spec 06), and the editor home wiring (spec 07) are all done. The workspace shell (spec 08) added the `/editor/[roomId]` route with a server-side access check (owner or existing collaborator) and a top navbar that already has a `Share` button — but that button is a `noop` placeholder. The `ProjectCollaborator` Prisma model exists in the schema and was migrated to Neon, but has zero application code reading or writing it.

Spec 09 wires the share button to a real dialog. Owners can invite/remove collaborators and copy the project link; collaborators see a read-only view with the owner badge. The intended outcome: clicking Share in the navbar opens a dialog that lists the owner + all collaborators, lets owners invite by email, lets owners remove a row with one click, and gives everyone a "Copy link" button. A `ProjectCollaborator` row is created/deleted on every owner action; the GET endpoint enriches emails with display name + avatar via Clerk Backend API.

**No schema migration, no new runtime dependencies, no shadcn primitive additions.** Everything lands on top of the existing `ProjectCollaborator` model and the `@clerk/nextjs/server` `clerkClient` already in `package.json` (`@clerk/backend` is NOT installed and not needed).

**Scope decisions confirmed with the user:**

1. **Fetch collaborators on dialog open, not via page-level data.** A small loading state inside the dialog is acceptable; the page stays JSON-serializable. Refresh after each invite/remove.
2. **Block invite with a 400 when Clerk has no user for the email.** Per spec line 31, surface an inline error so the user can correct the input rather than re-typing the same address.
3. **Show the owner as the first row with an "Owner" badge** (per spec line 12), even when the viewer is the owner. No separate "You" badge on the owner row — that would be redundant.

**Follow-up scope decisions (added during implementation):**

4. **Inline `CollaboratorAvatar` instead of installing shadcn `Avatar`.** The dialog renders ≤1 owner + N collaborators in fixed-size circles. A 15-line initials + `<img>` overlay covers every case without a new primitive, new dep, or a touch to the protected `components/ui/*` files. Decision documented in the dialog's file header.
5. **No `EditorDialog.Footer`** on the share dialog. The close X is in the top-right (`showCloseButton` default). The "Remove" action is per-row, single-click, and trivially reversible (re-invite by email), so no destructive confirm is needed.
6. **Email is lowercased everywhere** — the validator (`lib/api/validation.ts`) trims + lowercases, the Prisma row stores the lowercased value, and the Clerk post-filter lowercases for the comparison. `Foo@Example.com` and `foo@example.com` are the same row.
7. **`getUserList` post-filter is exact match.** Clerk's `emailAddress` filter is documented as a case-insensitive partial match, so the response is re-filtered against the requested email (case-insensitive) before any caller sees a hit. Defensive against Clerk returning stale or unrelated matches.

## Files to create

### `lib/clerk-users.ts` (new)

Server-only Clerk Backend wrapper. The only file that imports `clerkClient` so the rest of the app can swap implementations and so the "never throws" contract is enforced in one place.

- `import "server-only"` at the top — guarantees the file cannot leak into a client bundle.
- `displayNameFromClerk(user)` — derives a display name from `firstName + lastName` (trimmed), falls back to `username`, then `null`. Pure function, no I/O.
- `findUserByEmail(email)` → `Promise<EnrichedUser | null>` — calls `clerkClient().users.getUserList({ emailAddress: [normalized] })`, post-filters the response to an exact case-insensitive match against the requested email, and returns `null` on miss. **Returns `null` (not a stub) — the invite route relies on this to reject unknown emails. A stub would silently invite non-existent accounts.** Returns `{ email, name, imageUrl }` on hit. Never re-throws — a Clerk failure logs and returns `null`.
- `findUserById(userId)` — same shape, for the owner lookup. `clerkClient().users.getUser(id)`.
- `enrichCollaborators(emails[])` → `EnrichedUser[]` — de-dupes inputs, runs `findUserByEmail` in parallel via `Promise.all`, fills in `null` → stub (`{ email, name: null, imageUrl: null }`) so the list endpoint can still render email-only rows. Input order preserved.

`EnrichedUser = { email: string; name: string | null; imageUrl: string | null }`.

### `hooks/use-share-dialog.ts` (new)

Client hook owning the dialog's state + handlers. Lives in its own file (not merged into `useProjectActions`) because the share dialog's state is independent of the create/rename/delete union and would only clutter that hook with fields the project dialogs don't use.

State: `isOpen`, `isLoading`, `isInviting`, `isRemovingId: string | null`, `isCopied`, `formEmail`, `errorMessage: string | null`, `owner: ShareOwner | null`, `collaborators: Collaborator[]`.

Handlers:

- `open()` — resets transient state and calls `void refresh()`.
- `close()` — clears all transient state.
- `refresh()` — `fetch(GET /api/projects/{id}/collaborators)`, populates `owner` and `collaborators`, surfaces `errorMessage` on non-2xx. `cache: "no-store"`.
- `submitInvite()` — POSTs `{ email }`, maps `USER_NOT_FOUND` / `ALREADY_COLLABORATOR` / `FORBIDDEN` to friendly inline errors, calls `refresh()` on success.
- `submitRemove(collaboratorId)` — DELETEs, calls `refresh()` on success.
- `copyLink()` — guards `typeof window !== "undefined"`, calls `navigator.clipboard.writeText(window.location.href)`, sets `isCopied = true`. A `useEffect` auto-clears it after 1.5s so the button reverts to "Copy link".

Local `readError(response)` helper parses `{ error: { code, message } }`, falls back to `Request failed ({status})`. Identical shape to the one in `useProjectActions` but kept local because the share hook needs the `code` field for code-specific mapping.

### `components/editor/share-project-dialog.tsx` (new)

`"use client"`. Presentational — receives all state + handlers straight through from the workspace client. Uses the established `EditorDialog` namespace (`Root` / `Content` / `Header` / `Description`).

Layout inside `EditorDialog.Content` (top to bottom, no `Footer`):

1. **Header** — `<h3 className="text-lg font-medium">Share project</h3>` + `EditorDialog.Description` (copy switches between owner and collaborator).
2. **Copy-link row** — `<code>` of `shareUrl` (hydrated from `window.location.href` in a `useEffect` to keep the static analysis pass clean — Next 16 RSC evaluates the function body even for `"use client"` components) + outline `Button` (`CopyIcon`/`CheckIcon`, label "Copy link"/"Copied!").
3. **Read-only banner** (only when `!isOwner`) — single muted line "Only the project owner can invite or remove collaborators." Replaces the invite form.
4. **Inline error block** (only when `errorMessage`) — `role="alert" aria-live="polite"`, `text-error text-xs`.
5. **Owner row** — `CollaboratorAvatar` + name/email + `Owner` badge (`bg-accent-dim text-brand uppercase tracking-wide rounded-md`). No remove button.
6. **Collaborators section** — small label "Collaborators (N)" + `ScrollArea` (`max-h-60`). Renders `Loading collaborators…` / `No collaborators yet.` / a `<ul>` of rows. Each row: avatar + name/email + `XIcon` ghost `Button` (only when `isOwner`).
7. **Invite form** (only when `isOwner`) — `<form onSubmit={preventDefault → onSubmitInvite()}>` with email `Input` (`bg-surface text-copy-primary placeholder:text-copy-muted`, same treatment as create/rename dialogs) + `Button type="submit"` (`UserPlusIcon` "Invite"). `disabled={!formEmail.trim() || isInviting}`.

**Inline `CollaboratorAvatar`**: 15-line circular `bg-elevated text-copy-secondary` div with initials derived from `name || email` (split on whitespace/`@`/`.`) or optional `<img>` overlay. Justified inline in the file header.

### `app/api/projects/[projectId]/collaborators/route.ts` (new)

`GET` (read for owner+collaborator) + `POST` (invite, owner-only). One file, two exports.

- `resolveReadAccess(ctx)` — `requireUserId` → `currentUser()` for email → `prisma.project.findFirst({ where: { id, OR: [{ ownerId }, { collaborators: { some: { email } } }] } })`. Returns `{ kind: "ok" | "auth" | "notFound" | "badId" }`.
- `resolveWriteAccess(ctx)` — `requireUserId` → `prisma.project.findUnique({ select: { ownerId } })` → ownership check. Returns `{ kind: "ok" | "auth" | "notFound" | "forbidden" | "badId" }`. Two-step pattern matches `app/api/projects/[projectId]/route.ts:58-69` so 404-vs-403 stay distinguishable.
- `accessResponse(failure)` — maps the failure kind to the right `unauthorized()` / `notFound()` / `forbidden()` / `badRequest()` helper.
- `resolveOwnerProfile(ownerId, requesterId)` — if the requester is the owner, read from their own `currentUser()` (cheapest path, no extra Clerk round-trip). Otherwise `findUserById(ownerId)`.
- `deriveName(user)` — `firstName + lastName` trimmed, falls back to `username`, then `null`. Local copy (avoids exporting from `clerk-users.ts` for one consumer; could be moved later if reused).
- `isPrismaUniqueViolation(error)` — narrow `typeof === "object" && "code" in error && code === "P2002"` check. Avoids importing the Prisma namespace just for one error code.
- `GET` — fetches `Project.ownerId`, fetches `ProjectCollaborator` rows ordered by `createdAt asc`, runs `enrichCollaborators(rows.email)` and `resolveOwnerProfile` in parallel via `Promise.all`, maps back to row shape with id preserved, returns `{ owner, collaborators }` with `Cache-Control: no-store`.
- `POST` — parses body via `parseInviteCollaboratorBody` → `findUserByEmail` pre-check (returns `400 USER_NOT_FOUND` on miss) → `prisma.projectCollaborator.create` → catches `P2002` → returns `409 ALREADY_COLLABORATOR`. On success, `201` with `{ id, email, name, imageUrl }` and `Location: /api/projects/{id}/collaborators/{collabId}` header.

### `app/api/projects/[projectId]/collaborators/[collaboratorId]/route.ts` (new)

`DELETE` only. Owner-only.

- `requireUserId` → `prisma.project.findUnique({ select: { ownerId } })` → ownership check (`403` if not owner) → `prisma.projectCollaborator.deleteMany({ where: { id, projectId } })` → if `count === 0`, `404` (row was already gone or never existed) → else `204`.

The `deleteMany` (vs `delete`) lets us distinguish 404 from 204 via the count, even when the row was already deleted. The `where: { id, projectId }` scope ensures a stray collaborator id from a different project can't be removed via this endpoint.

## Files to modify

### `lib/api/validation.ts` (modified)

Added `parseInviteCollaboratorBody(input)` next to the existing name parsers. Reuses `isPlainObject`, `invalidBody`, `rejectUnknownFields`.

- `EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` — pragmatic match (not RFC-5322). Clerk is the source of truth for "does this account exist".
- Trims + lowercases the email so the `@@unique([projectId, email])` constraint catches duplicates regardless of input casing.
- `INVALID_BODY` for shape errors, `INVALID_EMAIL` for the regex miss — distinct codes so the client hook can map them differently if needed (currently both surface as the API's `badRequest` message).

### `components/editor/index.ts` (modified)

Added `export { ShareProjectDialog, type ShareProjectDialogProps } from "./share-project-dialog";` after `RenameProjectDialog` (alphabetical position). No other re-exports added — the hook's `Collaborator` / `ShareOwner` types are only consumed by the dialog, not re-exported through the components barrel.

### `app/editor/[roomId]/page.tsx` (modified)

Added `const isOwner = project.ownerId === identity.userId;` after the access check, and passes `isOwner` to `<EditorWorkspaceClient>`. Computed server-side so the client cannot escalate the read-only view by manipulating props.

### `app/editor/[roomId]/editor-workspace-client.tsx` (modified)

- Added `isOwner: boolean` to `EditorWorkspaceClientProps`.
- Deleted the `noop` placeholder.
- Imported `useShareDialog` from `@/hooks/use-share-dialog`.
- Imported `useUser` from `@clerk/nextjs` — `useUser()` supplies the signed-in user's primary email so the dialog can render a "You" badge next to the viewer's own row. The email is only used for a client-side label match; no server trust boundary depends on it.
- Instantiates `useShareDialog({ projectId: project.id })`.
- Replaced share button `onClick={noop}` with `onClick={share.open}`.
- Mounted `<ShareProjectDialog>` after `<DeleteProjectDialog>`, passing all the hook's fields through plus `isOwner` and `currentUserEmail`.

### `lib/projects-data.ts` (modified)

`getProjectsForCurrentUser` no longer returns `shared: []` — it now queries the projects the user is a collaborator on.

- Fetches the user's email via `currentUser().emailAddresses[0]?.emailAddress.toLowerCase()`.
- Runs two parallel `prisma.project.findMany` queries:
  - **owned** (unchanged): `where: { ownerId: userId }`, `orderBy: createdAt desc`, `select: { id, name }`.
  - **shared** (new): `where: { collaborators: { some: { email } } }` when an email is available, else resolves to `[]`. `select: { id, name, ownerId }`, same ordering.
- Maps shared rows to `Project` with `isOwner: false` and `ownerId: row.ownerId`.

This is the fix for the "shared projects don't show in the sidebar" bug — the previous code unconditionally returned `shared: []`.

## API contract

### `GET /api/projects/[projectId]/collaborators`

- **Access:** owner OR collaborator (matched by `ProjectCollaborator.email === currentUserEmail`).
- **200:** `{ owner: { userId, email, name, imageUrl } | null, collaborators: [{ id, email, name, imageUrl }] }` — both enriched by Clerk.
- **404** if project missing OR user has no access. **401** if unauthenticated. **400** if `projectId` is empty.
- `Cache-Control: no-store`.

### `POST /api/projects/[projectId]/collaborators`

- **Access:** owner only.
- **Body:** `{ email: string }` (lowercased + trimmed in the parser; `EMAIL_REGEX` validated).
- **201:** `{ id, email, name, imageUrl }` + `Location` header.
- **400 `USER_NOT_FOUND`** if Clerk has no user for the email (the pre-check).
- **400 `INVALID_EMAIL`** / `INVALID_BODY` for shape errors.
- **409 `ALREADY_COLLABORATOR`** if a `ProjectCollaborator` row already exists for that `(projectId, email)`.
- **403** if not owner. **404** if project missing.

### `DELETE /api/projects/[projectId]/collaborators/[collaboratorId]`

- **Access:** owner only.
- **204** on success.
- **404** if project missing, or if the row doesn't exist (count check), or if the row exists but belongs to a different project.
- **403** if not owner.

All handlers use `requireUserId()` (`lib/api/auth.ts`), `json()` / `forbidden()` / `notFound()` / `badRequest()` / `noContent()` (`lib/api/responses.ts`), and the `RouteContext<'/api/...'>` global (Next 16 — requires `bunx next typegen` before `tsc`). Two-step find-then-mutate ownership pattern matches `app/api/projects/[projectId]/route.ts:58-69`.

## Bug fixes during implementation

### 1. `findUserByEmail` returned a stub on miss (security)

The original `findUserByEmail` returned `{ email, name: null, imageUrl: null }` (a non-null stub) on no-match, and the route handler did `if (!clerkUser)`. The stub is truthy, so the gate never fired and any email could be invited. **Fix:** `findUserByEmail` now returns `null` (not a stub) on miss. The route's check became `if (clerkUser === null)` with a comment explaining the null-vs-stub contract so a future refactor doesn't weaken it back to a truthiness check. The list endpoint (`enrichCollaborators`) keeps its permissive behavior — missing users render as email-only rows per the spec fallback rule.

### 2. Shared projects didn't show in the sidebar

`getProjectsForCurrentUser` returned `shared: []` unconditionally. The sidebar's "Shared" tab was always empty. **Fix:** the helper now queries `where: { collaborators: { some: { email } } }` (with the user's email lowercased) and maps the rows to `Project` with `isOwner: false`. The owner's sidebar list now populates the Shared tab; collaborators see the projects they were invited to.

### 3. "You" badge for the current viewer's own row (UX)

Collaborators could see the list but couldn't easily tell which row was them. **Fix:** added `currentUserEmail: string | null` to `ShareProjectDialog`'s props, sourced from `useUser().emailAddresses[0]?.emailAddress` in the workspace client. Each collaborator row checks `row.email.toLowerCase() === currentUserEmail.toLowerCase()` and renders a small "You" badge (`bg-subtle text-copy-secondary uppercase tracking-wide rounded-md`). The owner row at the top keeps its primary "Owner" badge and is not additionally tagged — that would be redundant (and the owner isn't in the collaborator list anyway).

## Verification

Run in this exact order from `D:\code\build-with-claude-code\ghost-ai`:

1. `bunx next typegen` — materializes the two new `RouteContext<...>` globals for the dynamic-segment routes.
2. `bun run typecheck` — must exit 0.
3. `bun run lint` — must exit 0.
4. `bun run fmt:check` — clean on all new files. Pre-existing drift in `.claude/context/specs/09-share-dialog.md` (the spec input) is ignored per the surgical-changes rule.
5. `bun run build` — must produce 10 routes + `Proxy (Middleware)`. New routes: `/api/projects/[projectId]/collaborators` (GET/POST) and `/api/projects/[projectId]/collaborators/[collaboratorId]` (DELETE).

### Manual smoke matrix (Neon + real Clerk session)

Prerequisite: `bunx prisma migrate deploy` against Neon (spec 07 already covered; spec 09 adds no migration).

| #   | Actor           | Action                                | Expected                                                                                                    |
| --- | --------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Owner A         | Open share dialog on project X        | Owner row with name + avatar; empty collaborator list; copy-link row                                        |
| 2   | Owner A         | Click "Copy link"                     | "Copied!" with `CheckIcon`; reverts to "Copy link" after ~1.5s                                              |
| 3   | Owner A         | Invite `nonexistent@example.com`      | Inline error: "No account exists for that email. They need to sign up first." (POST 400 `USER_NOT_FOUND`)   |
| 4   | Owner A         | Invite a real Clerk user's email      | New row appears with name + avatar; form clears (POST 201)                                                  |
| 5   | Owner A         | Click X on a row                      | Row removed (DELETE 204)                                                                                    |
| 6   | Owner A         | Invite same email twice               | First succeeds; second shows "That email is already invited" (POST 201 → 409 `ALREADY_COLLABORATOR`)        |
| 7   | Collaborator B  | Open Share dialog                     | Read-only: no invite form, no X buttons, banner visible, owner + B's own row with "You" badge visible       |
| 8   | Collaborator B  | POST/DELETE via devtools              | 403 `FORBIDDEN` (server-side ownership check)                                                               |
| 9   | Collaborator B  | Visit `/editor`                       | The "Shared" tab lists project X with a clickable row; the `...` menu is hidden (per `project-item.tsx:51`) |
| 10  | Unauthenticated | GET `/api/projects/{x}/collaborators` | 401 `UNAUTHENTICATED`                                                                                       |

Steps 7–9 are the read-only / shared-tab flows. `isOwner` is computed server-side from `project.ownerId === identity.userId` — the client cannot escalate it. The shared-tab query in `getProjectsForCurrentUser` only matches by `email`; an attacker cannot inject another user's project into their sidebar because Clerk's `currentUser().emailAddresses[0]` is server-side.

## Gotchas

1. **`window.location.href` is SSR-unsafe.** The dialog hydrates `shareUrl` in a `useEffect` to keep the static analysis pass clean. Next 16 RSC evaluates the function body even for `"use client"` components.
2. **`clerkClient()` is async in `@clerk/nextjs@7`.** Both `findUserByEmail` and `findUserById` must `await clerkClient()`. The function is `Promise<ClerkClient>`.
3. **`getUserList` is a partial-match filter.** The post-filter on `emailAddresses[]` is the actual exact-match gate. `clerkClient.users.getUserList({ emailAddress: ["alice"] })` could return `"alice@example.com"`; the post-filter rejects it.
4. **`@@unique([projectId, email])` maps to `P2002`.** POST handler catches the unique violation and returns 409. Don't pre-check with `findUnique` — race conditions between concurrent invites would slip through; the unique violation is the authoritative signal.
5. **No shadcn `Avatar` primitive.** Inline 15-line initials circle, justified in the dialog's file header. Avoids a new dep + a touch to protected `components/ui/*`.
6. **`RouteContext<...>` globals need `next typegen` first.** Both new dynamic routes trigger this; run once before `tsc`.
7. **Email is lowercased everywhere.** Parser → DB → Clerk match. `Foo@Example.com` and `foo@example.com` are the same row.
8. **No DB migration.** `ProjectCollaborator` is already in `prisma/models/project.prisma` and migrated to Neon in spec 07.
9. **No new runtime deps.** `@clerk/nextjs/server` exposes `clerkClient`; `@clerk/backend` is NOT installed and not needed. All required icons (`CopyIcon`, `CheckIcon`, `UserPlusIcon`, `XIcon`) are in the installed `lucide-react@1.x`.
10. **Owner can technically invite their own email** — not blocked by this spec. The `@@unique([projectId, email])` constraint makes it a no-op (the first invite succeeds, the second hits 409), and the owner row at the top of the dialog has the "Owner" badge so the user can recognize themselves. Worth a follow-up if a future spec wants to explicitly reject self-invites.
