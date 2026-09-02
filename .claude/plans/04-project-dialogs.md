# Spec 04 — Project Dialogs Implementation Plan

## Context

The editor chrome (navbar + sidebar shell) shipped in spec 02, and Clerk auth landed in spec 03. The sidebar currently shows "No projects yet." placeholders and the editor home shows a bare "Canvas" stub. This spec stands up the **project CRUD surface** — the `/editor` home screen plus Create / Rename / Delete project dialogs and the per-project actions in the sidebar — entirely on **mock data** so the UI is real and reviewable before persistence is wired.

No API, no Prisma, no Server Actions. A single client component owns the project list state via a dedicated hook, dialog state is colocated, and the three dialogs are mounted once at the editor page level so the home CTA and sidebar CTA share the same open handlers.

## Resolved Decisions

| Question                                    | Decision                                                                                                                                           | Why                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-item actions trigger                    | **Inline `MoreHorizontalIcon` button → shadcn `DropdownMenu`**                                                                                     | Cleaner than 2 inline buttons, scales to future actions (share, duplicate). Add via `bunx shadcn@latest add dropdown-menu` — new file, doesn't touch protected primitives.                                                                                                                                     |
| Hook location                               | `hooks/use-project-dialogs.ts`                                                                                                                     | Editor-specific today, but the first project hook, so it lives in the project-root `hooks/` directory (matches the `@/hooks` alias in `components.json`). When the project list graduates to a real store, the hook is the seam — consumers don't change.                                                      |
| Project state source of truth               | Hook owns `useState<Project[]>` initialized from `mockProjects` const exported from `lib/projects.ts`                                              | Simple, no module-level mutation (keeps React re-renders correct), no new store.                                                                                                                                                                                                                               |
| Slug derivation                             | `name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+\|-+$/g, "")` — recomputed each render from form state                          | No debounce, no extra state.                                                                                                                                                                                                                                                                                   |
| Mobile detection                            | **Tailwind-only** (`md:` breakpoint) — no `useMediaQuery` hook                                                                                     | Matches existing project patterns (no JS media query anywhere). The backdrop is `md:hidden` and the close handler only fires on small screens.                                                                                                                                                                 |
| Click-outside-to-close                      | A dedicated `<button>` backdrop element at `z-30` (sidebar is `z-40`) with `md:hidden`. Click closes the sidebar.                                  | Also satisfies the "backdrop scrim" requirement. Using `<button>` (not `<div>`) gives keyboard a11y for free. No `useRef` / `mousedown` listener needed.                                                                                                                                                       |
| Enter submits rename                        | Wrap input in `<form onSubmit>` so Enter submits natively                                                                                          | Native, accessible, no `requestSubmit` plumbing.                                                                                                                                                                                                                                                               |
| Delete dialog: no input, destructive button | No `<form>`. Confirm is `<Button variant="destructive" onClick={confirm}>`                                                                         | Matches spec ("no input").                                                                                                                                                                                                                                                                                     |
| `showCloseButton` on Delete                 | `false` — destructive flows should be intentional, not casually dismissed                                                                          | Aligns with destructive UI conventions.                                                                                                                                                                                                                                                                        |
| `EditorDialog.Footer.showCloseButton`       | `false` everywhere; rely on the dialog's own `showCloseButton={true}` on Content                                                                   | Keeps the footer to the two action buttons only.                                                                                                                                                                                                                                                               |
| Input text contrast in dialogs              | Per-consumer `className="bg-surface text-copy-primary placeholder:text-copy-muted"` on the `Input` primitive inside both Create and Rename dialogs | The shadcn `Input` has `bg-transparent` and no explicit text color; native `<input>` color inheritance is unreliable, so the entered text + placeholder rendered nearly-invisible against the `bg-base` modal. The fix is per-consumer — the `Input` primitive is untouched per the protected-foundation rule. |

## Files

### Create

- `lib/projects.ts` — `Project` interface (`id`, `name`, `slug`, `ownerId`, `isOwner`, `collaborators?`), pure `slugify(name)` helper, and a `mockProjects` array (2 owned: "Auth Service Redesign", "Event Pipeline"; 1 shared: "Platform Roadmap"). No persistence.
- `hooks/use-project-dialogs.ts` — new `hooks/` directory at project root. Client hook owning the project list (`useState<Project[]>` seeded from `mockProjects`), dialog state as a discriminated union, shared `formName` and `isSubmitting`. Public API: `openCreate` / `openRename` / `openDelete` / `closeDialog`, `setFormName`, `submitCreate` / `submitRename` / `submitConfirmDelete`. ID generation via `crypto.randomUUID()` with a fallback for SSR safety.
- `components/editor/project-item.tsx` — sidebar row. Name on the left; owned items get a `MoreHorizontalIcon` ghost button (opacity 60 → 100 on row hover) opening a shadcn `DropdownMenu` with `PencilIcon` Rename + `TrashIcon` Delete (the latter uses the new `variant="destructive"` on `DropdownMenuItem`). Shared/collaborator items render the name only — no menu.
- `components/editor/create-project-dialog.tsx` — controlled dialog using `EditorDialog`. Name `Input` (with the contrast fix) + a live `slugify(formName)` preview below. Footer Cancel + Create (`type="submit"`). Submit on `<form onSubmit>` so Enter creates.
- `components/editor/rename-project-dialog.tsx` — controlled dialog. Description shows the current project name. Input `autoFocus` + `onFocus` select-all. Save is `type="submit"` (Enter submits). Submit is disabled when the trimmed name is empty, unchanged, or submitting.
- `components/editor/delete-project-dialog.tsx` — destructive confirmation. `EditorDialog.Content showCloseButton={false}`. Description names the project and includes "This action cannot be undone." Footer Cancel + Delete (`variant="destructive"`, no form, direct `onClick`).
- `components/ui/dropdown-menu.tsx` — added via `bunx shadcn@latest add dropdown-menu`. The only new shadcn primitive needed; generated, then left untouched per the protected-foundation rule.

### Modify

- `app/editor/page.tsx` — `Canvas` placeholder replaced with the home content: heading + description + `Button` with `PlusIcon` opening Create. No card wrapper. Page instantiates `useProjectDialogs()`, mounts the three dialogs alongside the sidebar, and passes `openCreate` to both the home CTA and the sidebar CTA.
- `components/editor/project-sidebar.tsx` — accepts `ownedProjects`, `sharedProjects`, `onCreate`, `onRename`, `onDelete` props. TabsContent bodies now render a `ScrollArea` of `ProjectItem`s or the existing "No projects yet." / "No shared projects yet." placeholders. Footer `New Project` button wired to `onCreate`. **Mobile backdrop**: a sibling `<button>` (z-30, `md:hidden`) — clicking it closes the sidebar. The X close and navbar toggle continue to work at all breakpoints.
- `components/editor/index.ts` — barrel re-exports `CreateProjectDialog`, `RenameProjectDialog`, `DeleteProjectDialog`, `ProjectItem` plus their prop types, alongside the existing `EditorNavbar` / `ProjectSidebar` / `EditorDialog`.

## Implementation Order (Dependency-Ordered)

1. `bunx shadcn@latest add dropdown-menu` — install the new primitive.
2. `lib/projects.ts` — types and mock data first so the hook can typecheck.
3. `hooks/use-project-dialogs.ts` — central state. No UI dependencies yet.
4. `components/editor/project-item.tsx` — needs the new dropdown primitive.
5. `components/editor/create-project-dialog.tsx` / `rename-project-dialog.tsx` / `delete-project-dialog.tsx` — independent of each other; can be built in any order once the hook exists.
6. `components/editor/project-sidebar.tsx` — modify to accept the new props, render `ProjectItem` lists, and add the mobile backdrop.
7. `app/editor/page.tsx` — wire the hook, mount the dialogs, replace the canvas placeholder with the home content.
8. `components/editor/index.ts` — add barrel exports last (catch-all).

## Critical Files

| File                                          | Action               | Why                                              |
| --------------------------------------------- | -------------------- | ------------------------------------------------ |
| `lib/projects.ts`                             | add                  | `Project` type, `slugify`, `mockProjects`        |
| `hooks/use-project-dialogs.ts`                | add                  | central dialog + form + project list state       |
| `components/editor/project-item.tsx`          | add                  | per-project row with optional actions menu       |
| `components/editor/create-project-dialog.tsx` | add                  | Create dialog with live slug preview             |
| `components/editor/rename-project-dialog.tsx` | add                  | Rename dialog with auto-focus + Enter submit     |
| `components/editor/delete-project-dialog.tsx` | add                  | Destructive confirmation dialog                  |
| `app/editor/page.tsx`                         | modify               | home content + dialogs host                      |
| `components/editor/project-sidebar.tsx`       | modify               | project list, wired New Project, mobile backdrop |
| `components/editor/index.ts`                  | modify               | re-export new components                         |
| `components/ui/dropdown-menu.tsx`             | add (via shadcn CLI) | per-item actions menu                            |

## Patterns Reused

- `EditorDialog` namespace from `components/editor/dialog.tsx` for every dialog — the `Content` already supplies `rounded-3xl bg-base text-copy-primary` and the `Footer` already supplies `rounded-b-3xl border-t border-surface-border`. No raw dialog imports.
- `cn()` from `lib/utils.ts` for conditional className composition (already used in the sidebar).
- `lucide-react` v1.x `Icon`-suffix names (`PlusIcon`, `MoreHorizontalIcon`, `PencilIcon`, `TrashIcon`, `XIcon`).
- shadcn `Tabs` already in use in the sidebar — same `My Projects` / `Shared` triggers, just swap the bodies.
- `ScrollArea` from shadcn (already installed) for the project list inside each tab so long lists don't overflow.
- `Button` variants `default`, `outline`, `destructive` — all present in `components/ui/button.tsx`.

## Verification

1. **Type check:** `bun run typecheck` (= `tsc --noEmit`) — must pass with strict mode.
2. **Lint:** `bun run lint` (= oxlint) — must pass.
3. **Format:** `bun run fmt:check` (= oxfmt --check) on changed files — must pass.
4. **Visual / functional walkthrough** (manual in dev server `bun run dev`):
   - Open `/editor`. Center shows heading + description + "New Project" button. Sidebar is open by default with 2 owned items + 1 shared.
   - Click home "New Project" → Create dialog opens. Type a name → slug preview updates live. Submit → dialog closes, new project appears in "My Projects".
   - Click sidebar "New Project" → same Create dialog opens.
   - Hover an owned item → "..." menu visible. Click → Rename + Delete options. Shared item: no menu.
   - Click Rename → input is focused and the current name is selected. Press Enter → saves, dialog closes, list updates.
   - Click Delete → destructive dialog. Confirm → item removed from list.
   - **Mobile (resize to <768px):**
     - With sidebar open, a dark scrim appears behind it. Click the scrim → sidebar closes.
     - The scrim is hidden on `md`+ viewports; the X / navbar toggle still close the sidebar.
5. **Ownership rule:** the shared project's row has no actions menu.
6. **Spec check-when-done:**
   - sidebar actions are wired ✓
   - slug preview works ✓
   - no TypeScript errors ✓
   - no lint errors ✓
