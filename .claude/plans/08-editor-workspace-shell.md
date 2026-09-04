# Plan: Editor Workspace Shell (Spec 08)

## Context

The editor home (`/editor`) is fully wired — sidebar lists real projects from Postgres, create/rename/delete go through the API, and the three dialogs are persisted. The next step in the build plan is the per-project workspace shell at `/editor/[roomId]`: a full-viewport layout with the existing sidebar (current room highlighted), a top navbar showing the project name with share + AI-sidebar actions, a centered canvas placeholder, and a right slide-over AI sidebar placeholder. **No canvas logic, Liveblocks, AI chat, or sharing behavior yet** — this iteration is chrome + access checks only.

The intended outcome: navigating to `/editor/<projectId>` lands a signed-in owner/collaborator inside the project workspace; unauthenticated visitors hit `/sign-in`; unauthorized or missing projects see a clean `AccessDenied` screen. The page is a server component — access is decided before any rendering happens. The home page and the home's `EditorNavbar` stay untouched; the new shell sits at a new route.

**Scope decisions confirmed with the user:**

1. **Treat `roomId` URL param as `Project.id`.** The Prisma `Project` table has no `roomId` column (the spec-07 progress note records the column was dropped and the future canvas spec will re-add it). For this iteration the URL slug is the cuid PK — same value the API returns, same value the home's list already carries. No migration, no schema change. The future Liveblocks spec aligns by reusing the same key.
2. **Pass `currentRoomId` from the workspace page to the sidebar via a new client child.** Mirrors the `EditorHomeClient` split from spec 07 — server fetches + decides access, client owns interactive state. The home page is unchanged.
3. **Extend `EditorNavbar` with optional `center` and `rightActions` slots.** Home passes nothing (rendering is unchanged). Workspace passes the project name + share + AI-sidebar toggle. Single source for chrome; the far-right `UserButton` stays in both contexts.

**Follow-up scope decisions (added during implementation):**

4. **Project rows are clickable for room switching.** The sidebar is the universal navigation surface (home and workspace both). The whole row is a `<Link href={`/editor/${project.id}`}>` so clicking the name navigates. The `MoreHorizontalIcon` is a sibling button outside the link so clicking it opens the dropdown menu instead of following the link. `DropdownMenuItem.onSelect` stops the default so Rename / Delete never navigate. `aria-current="page"` is set when the row is active; `cursor-pointer` on the link signals clickability. The shared tab wires the same way (no-op until `getProjectsForCurrentUser.shared` is populated).
5. **Create navigates to the new room.** `submitCreate` reads the 201 body from `POST /api/projects`, extracts `created.id`, and calls `router.push(`/editor/${created.id}`)`. The intermediate `router.refresh()` is dropped — the workspace page fetches its own data on navigation. Rename and delete still call `router.refresh()` because they don't change the active route.
6. **Canvas placeholder is padded to its visible area.** The left and right sidebars are `fixed` overlays (per the floating-sidebar pattern) so they don't push content horizontally. The `main` element gets `pl-72 pl-0` and `pr-80 pr-0` (matching `w-72` for the project sidebar and `w-80` for the AI sidebar) so the "Canvas" placeholder centers in the visible area, not the full viewport. `transition-[padding] duration-200` syncs with the sidebars' `transition-transform duration-200`. The same overlap exists on the home page's centered card and is a follow-up.

## Files to create

### `lib/project-access.ts` (new)

Server-only helper for the workspace page's access decision. Two functions, both wrapped in one module so the page's `await` chain stays a few lines.

- `getCurrentIdentity(): Promise<{ userId: string; email: string } | null>` — calls Clerk's `auth()` for the userId and `currentUser()` for the primary email (`emailAddresses[0].emailAddress`). Returns `null` if `userId` is null (defense in depth — `proxy.ts` already gates `/editor`). Single Clerk round-trip per request.
- `getAccessibleProject(roomId: string, identity: { userId: string; email: string })` → `prisma.project.findFirst({ where: { id: roomId, OR: [{ ownerId: userId }, { collaborators: { some: { email } } }] }, select: { id: true, name: true, ownerId: true } })`. Returns the row or `null`. **Unifies "not found" and "not authorized"** — both surfaces are `AccessDenied` per spec, so collapsing them is intentional. If a future spec needs the 403-vs-404 distinction for the workspace page, the helper splits into two queries.

`getProjectsForCurrentUser` (`lib/projects-data.ts:24`) is reused as-is for the sidebar's owned/shared list — the workspace page calls it separately to populate the sidebar without duplicating the query.

### `components/editor/access-denied.tsx` (new)

Server component (no interactivity). Full-viewport centered panel: a `LockIcon` (lucide) at `h-8 w-8 text-copy-muted`, a heading "You don't have access to this project", a one-line subhead "Ask the project owner to invite you, or pick another from your projects." then a `Button variant="outline"` link (`<a href="/editor">` rendered with `asChild` from the slot pattern) — "Back to projects". Plain `bg-base` background so the spec's "centered layout" reads on the dark workspace. No modifications to `components/ui/*`.

### `app/editor/[roomId]/page.tsx` (new)

Async server component. Short, decision-only:

1. `const identity = await getCurrentIdentity(); if (!identity) redirect("/sign-in");` — defense in depth (proxy already handles it but the spec mandates the redirect).
2. `const project = await getAccessibleProject(params.roomId, identity); if (!project) return <AccessDenied />;` — single `AccessDenied` for both missing and unauthorized per spec.
3. `const { owned, shared } = await getProjectsForCurrentUser(); const projects = [...owned, ...shared];`
4. Render `<EditorWorkspaceClient project={{ id, name }} projects={projects} />`.

Uses Next 16's `PageProps<"/editor/[roomId]">` global with `await params` (the `PageProps<>` global is for pages; `RouteContext<>` is for API route handlers — first typecheck tried `RouteContext<>` and Next 16 rejected it).

### `app/editor/[roomId]/editor-workspace-client.tsx` (new)

`"use client"`. Mirrors `app/editor/editor-home-client.tsx:21` shape. Owns two pieces of UI state: `isSidebarOpen` (left project sidebar, default `true`) and `isAiSidebarOpen` (right AI sidebar, default `false`). Receives:

- `project: { id: string; name: string }` (the access check's result)
- `projects: Project[]` (the sidebar's owned + shared list)

Layout (`flex h-dvh flex-col bg-base`):

- `<EditorNavbar isOpen={isSidebarOpen} onToggle={...} center={project.name} rightActions={<ShareButton onClick={noop} /><AiToggle onClick={...} />} />`
- `<ProjectSidebar isOpen={isSidebarOpen} ownedProjects={...} sharedProjects={...} currentRoomId={project.id} onClose={...} onCreate={noop} onRename={noop} onDelete={noop} />` — the `onCreate / onRename / onDelete` callbacks are no-ops here (workspace page doesn't open the home's dialogs; the spec is silent on this, and re-mounting the home's dialogs from a workspace page would invite cross-route state confusion). A `// TODO: route to /editor?action=... or open a workspace-scoped dialog in a follow-up spec` comment marks the spot.
- `<main>` with `pl-72 pr-80` padding toggled by sidebar state so the canvas placeholder centers in the visible area between the two `fixed` overlays. `transition-[padding] duration-200` syncs with the sidebars' slide animation.
- `<aside className={cn("fixed right-0 top-14 bottom-0 z-40 w-80 border-l border-surface-border bg-base/95 backdrop-blur-md transition-transform duration-200", isAiSidebarOpen ? "translate-x-0" : "translate-x-full")}>` — placeholder for the future AI chat. Header `AI` + a `XIcon` close button. Body has a `text-copy-muted` "AI chat coming soon." line.

The `ShareButton` and `AiToggle` are tiny local button definitions in this file — not new shared components, since the share button is a placeholder per the spec scope. A short comment notes the intent.

## Files to modify

### `components/editor/editor-navbar.tsx` (modified)

Add two optional props and render them in the existing flex sections:

- `center?: ReactNode` — rendered inside the existing empty middle `<div>`. The middle section becomes `min-w-0 flex-1 justify-center` so a long project name clips instead of stretching the navbar. Wrapped in `<div className="truncate text-sm font-medium text-copy-primary">` so the name gets the right type treatment.
- `rightActions?: ReactNode` — rendered inside a new wrapper before the `UserButton`. The right section becomes `flex items-center gap-2` to host the actions group.

The home page (which calls `EditorNavbar` with no `center` / `rightActions`) is unaffected — the `center` div is still empty when the prop is absent.

### `components/editor/project-sidebar.tsx` (modified)

Accept an optional `currentRoomId?: string` prop and forward it to each `ProjectItem` as `isActive={project.id === currentRoomId}`. No other behavior changes — the highlight styling lives in `ProjectItem`.

### `components/editor/project-item.tsx` (modified)

Accept an optional `isActive?: boolean` prop. When true, append `bg-subtle` to the row's className via `cn()`. Imported `cn` from `@/lib/utils`.

**Follow-up change (clickable rows):** the row's name area is now wrapped in `<Link href={`/editor/${project.id}`}>` so clicking the name navigates to the room. `aria-current="page"` is set when `isActive` (helps screen readers announce the current room). `cursor-pointer` on the link so the cursor signals clickability. The `MoreHorizontalIcon` is a sibling `<Button asChild>` _outside_ the link so the dropdown trigger opens the menu instead of following the link. `DropdownMenuItem.onSelect` stops the default, so Rename / Delete never navigate either. The whole row's flex container stays as before — the link is just a flex-1 child of it.

### `hooks/use-project-actions.ts` (modified)

The `submitCreate` handler now reads the 201 body from `POST /api/projects`, casts the response to `{ id: string }`, and calls `router.push(`/editor/${created.id}`)` instead of `router.refresh()`. The intermediate refresh is gone — the workspace page fetches its own data on navigation. Dialog state still resets (`setDialog({ type: null })`, `setFormName("")`) before the push. The header comment is updated to note that Create navigates, Rename and Delete still refresh.

`submitRename` and `submitConfirmDelete` are unchanged from spec 07.

## Files to leave alone

- `app/editor/page.tsx` and `app/editor/editor-home-client.tsx` — home is fully wired and the spec doesn't ask to change it. The same canvas-overlap fix probably belongs here too (its centered card has the same semi-transparent-sidebar bleed-through) but was deferred per the user's "fix the room page sidebar" scope.
- `lib/projects-data.ts`, `lib/projects.ts`, `lib/api/*`, `lib/prisma.ts` — all reused as-is.
- `prisma/*`, `proxy.ts`, `app/api/projects/*` — no changes.
- `components/editor/dialog.tsx`, the three dialogs, the shadcn `components/ui/*` — no changes (the protected-foundation rule).
- `app/globals.css` — no new tokens needed; everything reuses `bg-base`, `bg-subtle`, `text-copy-primary`, `text-copy-muted`, `border-surface-border`.

## Per-action design

### Click a sidebar row → navigate

1. User clicks a project row in the sidebar (home or workspace).
2. The `<Link>` navigates to `/editor/<projectId>`. The dropdown trigger sits outside the link and the `DropdownMenuItem.onSelect` is independent, so clicking the `...` icon opens the menu (and clicking Rename/Delete inside the menu fires the existing home dialog flow).
3. The home page's `submitCreate` post-navigation: when a new project is created, the hook calls `router.push(`/editor/${created.id}`)`, the workspace page server-fetches, the sidebar's `currentRoomId` lights up the new row.

### Create → navigate to the new room

1. User opens Create dialog. Hook sets `dialog = { type: "create" }`, `formName = ""`.
2. User types a name, sees the live slug preview.
3. User clicks Create. Hook:
   - Trims `formName`. If empty, no-op.
   - Sets `isSubmitting = true`.
   - Reserves room ID locally: `slugify(name) + "-" + shortSuffix()`.
   - `fetch("/api/projects", { method: "POST", body: JSON.stringify({ name }) })`.
   - On 201: read the body as `{ id: string }`, close dialog, reset form, `router.push("/editor/${created.id}")`.
   - On non-201: log, keep dialog open, set `isSubmitting = false`.

### Access check (workspace page)

1. Page server-renders, `getCurrentIdentity()` runs.
2. If `userId` is null → `redirect("/sign-in")` (defense in depth; proxy already 307's).
3. `getAccessibleProject(roomId, identity)` runs. If the project doesn't exist or the user isn't the owner and isn't a collaborator by email → `<AccessDenied />`.
4. Otherwise → `<EditorWorkspaceClient project={...} projects={...} />`.

### Layout render (client child)

1. Navbar shows project name (center), Share button (right), AI toggle (right), User button (far right).
2. Left sidebar slides in over the canvas; current room's row has a `bg-subtle` highlight. Clicking any other row navigates to that room.
3. `main` is `flex-1` with `pl-72 pl-0` and `pr-80 pr-0` padding toggled by sidebar state. The "Canvas" placeholder centers in the visible area between the two sidebars.
4. Right AI sidebar is `translate-x-full` by default; clicking the navbar AI toggle flips it on/off (mirror of the left sidebar's open/close). When it opens, `main` gains `pr-80` and the canvas re-centers.

## Verification

### Automated gates (all must pass)

1. `bun run fmt:check` — oxfmt is strict (double quotes, no semicolons).
2. `bun run lint` — oxlint.
3. `bun run typecheck` (tsc --noEmit) — run `bunx next typegen` first if it complains about `PageProps<>` or `RouteContext<>`.
4. `bun run build` — must produce 8 routes (`/` + `/_not-found` + `/sign-in/[[...sign-in]]` + `/sign-up/[[...sign-up]]` + `/editor` + `/editor/[roomId]` + `/api/projects` + `/api/projects/[projectId]`) + `Proxy (Middleware)`.

### Manual smoke matrix (with Clerk-signed cookie, dev server)

- **Owner can enter.** Signed in, at least one project in DB → `GET /editor/<ownProjectId>` → 200, navbar shows project name, current room row is highlighted in the left sidebar, canvas placeholder is centered in the visible area between the two sidebars, right AI sidebar is hidden.
- **AI toggle works.** Click navbar AI toggle → right sidebar slides in. `main` gets `pr-80`, canvas re-centers. Click again → slides out, padding reverts.
- **Left sidebar still works.** Click navbar left toggle → left sidebar closes/opens. `main` padding flips `pl-72 ↔ pl-0`. Current room highlight persists across toggles.
- **Create navigates.** Click New Project → type a name → Create → dialog closes → user lands on `/editor/<newId>` with the workspace shell rendering, project name in the navbar, current row highlighted in the sidebar.
- **Sidebar navigation.** On `/editor/<idA>`, click a different row in the sidebar → URL changes to `/editor/<idB>`, workspace shell re-renders with the new project name and the new row highlighted. Works for both the My Projects and (when populated) Shared tabs.
- **Dropdown still works.** Click the `...` icon on an owned row → menu opens. Click Rename → rename dialog opens (no navigation). Click Delete → delete dialog opens (no navigation).
- **Unauthenticated redirect.** Sign out → `GET /editor/<anyId>` → 307 to `/sign-in` (proxy still covers; the page-level redirect is unreachable but is the explicit defense-in-depth line in the spec).
- **Nonexistent project.** Signed in, `GET /editor/does-not-exist` → 200 with `AccessDenied` ("You don't have access to this project" + "Back to projects" link). Same response for an empty/whitespace `roomId` (handled by `getAccessibleProject` returning `null`).
- **Collaborator access (when collaborators exist).** Seed a `ProjectCollaborator` row with the signed-in user's email for a project they don't own → `GET /editor/<thatProjectId>` → 200 workspace shell.
- **Collaborator by email mismatch.** User A's email is not in the project's collaborators → `GET /editor/<thatProjectId>` → `AccessDenied`. Same as not-found.
- **Home page regression.** `GET /editor` still works, no layout shifts, the navbar still has no center/right actions (props default to undefined). The same canvas-overlap fix probably belongs here too (its centered card has the same semi-transparent-sidebar bleed-through) — flagged as a follow-up.
- **Sidebar highlight.** On `/editor/<projectId>`, the matching project row in the left sidebar has the `bg-subtle` highlight; the other rows do not.

## Out of scope (do not touch)

- Real canvas surface (Liveblocks + React Flow) — the spec says "no canvas logic yet".
- AI chat panel content — right sidebar is a placeholder div.
- Sharing behavior — share button is a no-op placeholder.
- Workspace-scoped create/rename/delete dialogs — the three dialogs are home-only. The workspace's sidebar dropdowns would need their own wiring; a follow-up spec handles it.
- `roomId` column on the `Project` model — the future canvas spec re-adds it (see `progress-tracker.md:156-158` session notes).
- `errorMessage` UX in dialogs — already on the post-07 follow-up list.
- Shared/collaborator data helper — `getProjectsForCurrentUser`'s `shared: []` placeholder stays; the workspace page only shows the accessible project, not the full shared list.
- The home page's centered card has the same canvas-overlap-with-sidebar bug as the workspace page had pre-fix. Easy to fix with the same `pl-72 pl-0` pattern in `app/editor/editor-home-client.tsx`, but was deferred per the user's "fix the room page sidebar" scope.

## Risks and callouts

1. **`AccessDenied` unifies 404 + 403.** Per spec, both look the same. If a future spec needs to distinguish (e.g. to show "this project was deleted" vs "you were removed"), `getAccessibleProject` is the seam — split into two queries and return a tagged union.
2. **Clerk `currentUser()` is a second round-trip per request.** It's used only in `getCurrentIdentity`. The workspace page is server-rendered on every navigation, so the cost is one Clerk request per page load — acceptable for the spec's "shell" iteration.
3. **EditorNavbar's new optional props.** The home passes no `center` / `rightActions`; the navbar renders an empty middle `<div>` in that case.
4. **Clickable rows open a subtle UX consideration.** The whole row is a link, but the `...` dropdown trigger and the dropdown items are not — the trigger sits outside the link and the items use `onSelect` to stop the default. This works with Radix's `DropdownMenuTrigger asChild` because the trigger composes as the inner `<Button>` rather than the outer `<a>`. The Radix `DropdownMenu` also renders its content via portal, so the menu floats above the link's DOM subtree. No nested-interactive-axe issues because the link is a single element and the menu is a separate subtree.
5. **No `prisma migrate` step.** The schema is unchanged; `lib/project-access.ts` only queries existing columns. The Neon migration story from spec 07 still stands: run `bunx prisma migrate deploy` once before the live smoke matrix.
6. **`tsc` may need `bunx next typegen` first.** Next 16's `PageProps<'/editor/[roomId]'>` is materialised by `next dev` / `next build` / `next typegen`. The first typecheck attempt used `RouteContext<>` (the API-route global) and Next 16 rejected it with `TS2344: Type '"/editor/[roomId]"' does not satisfy the constraint 'AppRouteHandlerRoutes'`. Switched to `PageProps<>` which is the page-component global; both are emitted by the same `next typegen` step, so the `next typegen` first dance is the same.
7. **Canvas padding tracks sidebar slide animation.** The sidebars use `transition-transform duration-200`; the `main` uses `transition-[padding] duration-200` so toggling either sidebar animates the canvas in sync. The two transitions are independent Tailwind classes (one targets `transform`, the other `padding`) so they don't fight for the same property.
