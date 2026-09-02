# Plan: Wire Editor Home to the Project API (Spec 07)

## Context

The project CRUD API (`app/api/projects/*`) and the editor chrome (sidebar + three dialogs) both exist but are not yet connected. The sidebar renders from a hardcoded `mockProjects` array in `lib/projects.ts:30`, and the three `submit*` handlers in `hooks/use-project-dialogs.ts` mutate local `useState` instead of calling the API. The user has now signed in, the Prisma data layer is live, and the spec calls for replacing the mock wiring with a real, server-driven data flow.

The intended outcome: the editor home page renders owned and shared projects from the database, the Create dialog persists a new project, the Rename dialog persists name changes, and the Delete dialog removes the project. The consumer surface of the dialog hook (the `openCreate` / `openRename` / `openDelete` / `closeDialog` / `setFormName` / `submit*` API the page and dialogs call) does not change — the swap is internal.

**Scope decisions confirmed with the user:**

1. **No new route.** Stay on `/editor`. Create/delete use `router.refresh()` to re-fetch server data; "navigate to the new workspace" means refresh the home with the new project in the list. The room ID is generated and stored for future Liveblocks use but is not in the URL.
2. **Replace the hook.** Delete `hooks/use-project-dialogs.ts`; create `hooks/use-project-actions.ts` with the same consumer API. The three dialogs and the page do not change.

## Files to create

### `lib/projects.ts` (modified)

The current `Project` interface (`lib/projects.ts:13-20`) is the UI mock shape — it includes `isOwner` and `collaborators` which the API does not return. The sidebar needs to distinguish owned from shared projects, but the API's `GET /api/projects` only returns projects the current user owns (filtered server-side by `ownerId: userId`). Shared projects are not in the data model yet.

- Keep the `Project` interface for the UI (id, name, slug, ownerId, isOwner, collaborators?). All current consumers (sidebar, project item, dialogs) use it.
- Delete the `mockProjects` array. Nothing references it after the hook swap.
- Keep `slugify(name)` — `create-project-dialog.tsx:34` and the new hook both use it.
- The type lives on, but the mock data goes. This keeps the diff minimal: one array deletion + removing the `mockProjects` export.

### `hooks/use-project-actions.ts` (new, replaces `hooks/use-project-dialogs.ts`)

A client hook that owns dialog state, form state, and the three mutations. Same exported type signature as the current `UseProjectDialogsResult` so consumers don't change.

Public API (unchanged from `use-project-dialogs.ts:26-44`):

- `ownedProjects: Project[]` — derived from server-fetched list (always owned in this iteration; shared list is empty).
- `sharedProjects: Project[]` — always `[]` for now (no shared endpoint yet; the sidebar's `Shared` tab will show "No shared projects yet.").
- `isCreateOpen`, `isRenameOpen`, `isDeleteOpen`, `renameTarget`, `deleteTarget`, `formName`, `isSubmitting` — all unchanged.
- `openCreate` / `openRename` / `openDelete` / `closeDialog` / `setFormName` — unchanged behavior (dialog state only, no fetch).
- `submitCreate` / `submitRename` / `submitConfirmDelete` — now call `fetch('/api/projects'[, '/api/projects/{id}'])` and surface errors.

Internal changes from the current hook:

- **Initial state.** `projects` is now empty (no mock seed). The actual list comes from the server component's prop. The hook no longer owns the project list — it just owns the dialog state. Owned/shared projections are always `{ ownedProjects: [], sharedProjects: [] }` for now; the real list is passed by the page.
- **Hook signature gains an input.** The page passes the server-fetched list into the hook as `useProjectActions(initialProjects: Project[])`, and the hook's `ownedProjects` / `sharedProjects` are derived from that input, not from local state. This preserves the consumer API (sidebar still reads `dialogs.ownedProjects`).
- **`submitCreate`**: `POST /api/projects` with `{ name }`. On 201, close dialog, reset form, `router.refresh()`. On error, `console.error` the API's `{ error: { message } }` body and keep the dialog open with `isSubmitting = false`. The "navigate to the new workspace" rule is satisfied by the refresh + the new project appearing at the top of the list.
- **`submitRename`**: `PATCH /api/projects/{id}` with `{ name: formName.trim() }`. On 200, `router.refresh()`. On error, log, keep open.
- **`submitConfirmDelete`**: `DELETE /api/projects/{id}`. On 204, close, `router.push("/editor")` (the workspace URL), `router.refresh()`. On error, log, keep open.
- **Short unique suffix for room ID.** Use `slugify(name) + "-" + shortSuffix()` where `shortSuffix()` is a 6-char hex string from `crypto.randomUUID()`. Tracked in a `useRef<Set<string>>` of taken suffixes to avoid duplicates within a session. The room ID is a stub for the future Liveblocks spec — not yet sent to the API (the POST handler derives the cuid PK server-side).
- **Error state.** The API returns `{ error: { code, message } }` for non-2xx. The hook's `readError` helper parses the body and falls back to `Request failed ({status})` if the body is not JSON. The hook `console.error`s the message and keeps the dialog open; no `errorMessage` field is exposed in this iteration (visual error rendering in the dialog description is a follow-up).

### `app/editor/page.tsx` (modified)

Convert from a pure client component to a **server component that mounts a client child**, so the project list can be fetched server-side via Prisma.

- The page itself becomes a `async function` server component.
- It calls the new project data helper (described next) to get `{ owned, shared }`.
- It passes those to a new `<EditorHomeClient />` client component (in `app/editor/editor-home-client.tsx`) that owns the `useState` for sidebar open/close and mounts the sidebar + dialogs + `useProjectActions` hook.
- The hook is now called with the initial list: `useProjectActions(initialProjects)`.

### `lib/projects-data.ts` (new)

A server-only data helper that the editor page calls. Becomes the single source of truth for the editor's project list (replaceable in a future spec that adds collaborators/shared-projects).

- `getProjectsForCurrentUser(): Promise<{ owned: Project[]; shared: Project[] }>`.
- Calls `auth()` from `@clerk/nextjs/server`. If `userId` is null, returns `{ owned: [], shared: [] }` (the proxy already redirected unauthenticated users, but defense in depth).
- For now, only `owned` is populated: `prisma.project.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" }, select: { id, name } })`. The full `PROJECT_SELECT` from `app/api/projects/route.ts:15-23` is overkill for the sidebar — the UI only renders `id` and `name`.
- Maps the Prisma rows into the UI's `Project` shape: `{ id, name, slug: slugify(name), ownerId: userId, isOwner: true }`.
- `shared` is `[]` for now (no collaborators endpoint yet). A comment marks the spot for the future spec.

### `components/editor/dialog.tsx` (unchanged)

No changes. The three dialogs already take their inputs via props and their `onOpenChange` / `onSubmit` callbacks are unchanged. Error rendering is deferred to a follow-up (this iteration logs to `console.error` and keeps the dialog open).

## Files to delete

- `hooks/use-project-dialogs.ts` — replaced by `use-project-actions.ts`.
- `mockProjects` export from `lib/projects.ts` (the file stays for the `Project` type and `slugify`).

## Per-action design

### Create

1. User opens Create dialog. Hook sets `dialog = { type: "create" }`, `formName = ""`.
2. User types a name, sees the live slug preview (already implemented in `create-project-dialog.tsx:58-60`).
3. User clicks Create (or hits Enter). Hook:
   - Trims `formName`. If empty, no-op.
   - Sets `isSubmitting = true`.
   - Reserves room ID locally: `slugify(name) + "-" + shortSuffix()`.
   - `fetch("/api/projects", { method: "POST", body: JSON.stringify({ name }), headers: { "Content-Type": "application/json" } })`.
   - On 201: close dialog, reset form, `router.refresh()`. No explicit navigate — `/editor` is the workspace URL, and the refresh re-fetches the server data so the new project appears at the top.
   - On non-201: log `error.message`, keep dialog open, set `isSubmitting = false`.
4. The page server-renders the new project at the top of the owned list after refresh.

### Rename

1. User clicks the `...` menu on a project → Rename. Hook sets `dialog = { type: "rename", project }`, `formName = project.name`.
2. User edits, clicks Save. Hook:
   - Trims. If empty or unchanged, no-op (matches the existing `canSubmit` check in `rename-project-dialog.tsx:35-36`).
   - Sets `isSubmitting = true`.
   - `fetch("/api/projects/{id}", { method: "PATCH", body: JSON.stringify({ name }), headers: { "Content-Type": "application/json" } })`.
   - On 200: close, reset, `router.refresh()`.
   - On non-200: log, keep open.

### Delete

1. User clicks Delete. Hook sets `dialog = { type: "delete", project }`.
2. User confirms. Hook:
   - Sets `isSubmitting = true`.
   - `fetch("/api/projects/{id}", { method: "DELETE" })`.
   - On 204: close, `router.push("/editor")` (the workspace URL), `router.refresh()`. The "redirect to /editor if deleting the active workspace" rule is satisfied by always navigating to `/editor` (where the user already is) + `router.refresh()`.
   - On non-204: log, keep open.

## Verification

### Automated gates (all must pass)

1. `bun run fmt:check` — oxfmt is strict (double quotes, no semicolons).
2. `bun run lint` — oxlint.
3. `bun run typecheck` (tsc --noEmit). If `RouteContext` or other Next 16 globals are missing, run `bun run build` once first to materialize `.next/types/`.
4. `bun run build` — the spec's "done" gate. Must produce 7+ routes.

### Manual smoke matrix (with Clerk-signed cookie, dev server)

For each of the three mutations, plus the initial load:

- **Initial load.** Signed in, empty DB → home renders with `No projects yet.` in the My Projects tab. After seeding one project via Prisma Studio or a prior session → it appears in the list.
- **Create.** Click `New Project` → dialog opens → type a name → click Create → dialog closes → project appears at the top of `My Projects`. Network tab shows `POST /api/projects` → 201 with `Location: /api/projects/{cuid}`.
- **Rename.** Click `...` → Rename → dialog pre-fills current name → edit → Save → dialog closes → project name updates in the list. Network: `PATCH /api/projects/{id}` → 200.
- **Delete.** Click `...` → Delete → confirm → dialog closes → project disappears from the list. Network: `DELETE /api/projects/{id}` → 204.
- **Slug preview.** While typing in the Create dialog, the `Slug:` line updates live (already implemented; verify it still works).
- **Auth gate.** Sign out → `/editor` redirects to `/sign-in` (proxy still covers it).
- **API auth.** `curl GET /api/projects` without a Clerk cookie → 401 (proxy or route handler).

## Out of scope (do not touch)

- `app/api/projects/*` — backend is done; no new routes or changes.
- `prisma/*` — schema and migration are correct.
- `proxy.ts` — Clerk already covers `/editor` and `/api/.*`.
- The three dialogs (`create-project-dialog.tsx`, `rename-project-dialog.tsx`, `delete-project-dialog.tsx`) — their prop signatures stay the same; the hook change is transparent.
- `components/editor/project-sidebar.tsx` — its `ownedProjects` / `sharedProjects` props come from the page; the source of the data (mock vs. server) is the only thing changing.
- Shared/collaborator projects — no API for them yet; the `Shared` tab stays empty. Marked in `lib/projects-data.ts` for the future spec.
- Error UX (toast, inline error message in the dialog description) — this iteration logs to `console.error` and keeps the dialog open. Adding visual error rendering is a follow-up.
- The room ID is generated client-side and not yet stored in the DB (the API doesn't accept a `roomId` field, and there's no Liveblocks surface to feed it to). It exists as a stub for the future real-time canvas spec.

## Risks and callouts

1. **The hook's consumer API gains an input.** The current `useProjectDialogs()` takes no args; the new `useProjectActions(initialProjects: Project[])` takes the server-fetched list. Page-level wiring changes by exactly one line: `useProjectDialogs()` → `useProjectActions(initialProjects)`. The dialogs and the page are otherwise untouched.
2. **`ownedProjects` / `sharedProjects` are now derived, not stored.** The hook no longer mutates `projects` on the three submits — `router.refresh()` re-fetches the server data, and the next render derives the lists from the new prop. The `submit*` handlers become much shorter.
3. **Server component → client component boundary.** The page becomes a server component that passes plain `Project[]` to a client child. The `Project` interface (with `ownerId`, `isOwner`, `collaborators?`) is fine for both — it's plain JSON-serializable. No Date or other non-serializable fields.
4. **Room ID suffix uniqueness within a session.** A `useRef<Set<string>>` of seen suffixes is enough — we only need to avoid two client-side IDs colliding in the same session. Real collision-safety is the future Liveblocks spec's job.
5. **Initial render with empty list.** The first render before refresh has no projects; the home shows `No projects yet.`. The `useProjectActions` hook's `submitCreate` succeeds and refresh fires — the next server-rendered render shows the new project. There's a brief flicker where the dialog closes and the project reappears, but it's a single `router.refresh()` and feels instant. If the flicker is noticeable, a `useOptimistic` update is a follow-up — out of scope here.
6. **oxfmt strictness.** Double quotes, no semicolons. Run `bun run fmt` after writing code.
7. **Clerk `auth()` in server component.** The page imports `auth` from `@clerk/nextjs/server`. The `proxy.ts` already redirects unauthenticated users, so the page-level check is defense in depth.

## Post-implementation corrections

Two environmental issues surfaced after the planned code landed and required unplanned fixes:

### `prisma dev` proxy rejected the 7.8.0 client with `P6000`

The local `prisma dev` proxy on port 51213 (v0.16.28) only supports Prisma Client up to 7.2.0 on the HTTP/Accelerate path. Prisma Client 7.8.0 (the version installed in this project) was rejected by the proxy at runtime with:

> Using an HTTP connection string is not supported with Prisma Client version 7.8.0 by this version of `prisma dev`. Please either use a direct TCP connection string or upgrade your client to version 7.2.0.

Fix: switched the Prisma singleton to direct TCP via `@prisma/adapter-pg` and dropped the Accelerate branch entirely. Three small changes:

- **`lib/prisma.ts`** — removed the `withAccelerate` import + the Accelerate branch in `createPrismaClient()`. The singleton now always uses `PrismaPg({ connectionString: url })`. The hot-reload `globalThis` cache is unchanged. The Accelerate-only `as unknown as PrismaClient` cast (added in spec 06) is also gone — the direct-TCP branch returns a base `PrismaClient` and the union-vs-base type problem is moot.
- **`.env.local`** — `DATABASE_URL` switched from `prisma+postgres://localhost:51213/?api_key=...` to the user's Neon Postgres connection string (`postgresql://...ep-orange-feather-...aws.neon.tech/neondb?sslmode=require&channel_binding=require`). The local `prisma dev` proxy is no longer in the data path.
- **`@prisma/extension-accelerate`** uninstalled via `bun remove`. No source code imported it after the singleton change; the generated client retains its `accelerateUrl` type declarations, but those are inert without the runtime import.

Verified the new path with `bunx prisma db pull --print` — connection succeeds end-to-end (returned `P4001: introspected database was empty` against Neon, which proves TLS + channel-binding negotiated successfully and the driver-adapter path is wired correctly). The migration needs to be applied to Neon separately via `bunx prisma migrate deploy` before `/editor` shows real data — that's a one-shot operation, not part of this spec.

### `.env` (not `.env.local`) was also edited in an earlier failed attempt

Earlier in the session, `.env` was changed from the Accelerate form to `postgres://postgres:postgres@localhost:51214/template1?...` (local direct TCP). That change is now obsolete because `.env.local` overrides it with the Neon URL, and Next.js loads `.env.local` with higher precedence. Left in place per the surgical-changes rule — the file is dead config but harmless, and reverting it would be a separate change.
