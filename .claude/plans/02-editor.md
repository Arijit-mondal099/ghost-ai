# Plan — Spec 02: Editor Chrome Components (Navbar, Sidebar, Dialog Pattern)

## Context

Spec 02 (`.claude/context/specs/02-editor.md`) is the first feature spec after the design-system foundation. The goal is to build the two base chrome components that frame every editor screen — the top **Editor Navbar** and the floating left **Project Sidebar** — plus a reusable **Dialog pattern** for future modals (no actual dialogs are built yet).

Per the user's clarifications, this spec delivers **components only** (no `app/editor/` route is created here). The components are built as client components ready to drop into a future editor route, which will own their `isOpen` state via `useState`. The dialog pattern is a thin wrapper around the existing shadcn `Dialog` primitive that bakes in the project's modal styling rules (`rounded-3xl`, dark surface, backdrop blur).

The progress tracker currently lists this as the next-up item; completing it unblocks spec 03 (real-time canvas surface) and the future AI sidebar work.

---

## Scope (what changes)

### New files

1. **`components/editor/editor-navbar.tsx`** — top navigation bar.
2. **`components/editor/project-sidebar.tsx`** — floating left sidebar.
3. **`components/editor/index.ts`** — barrel export for the editor composables.
4. **`components/editor/dialog.tsx`** — Dialog pattern wrapper around the shadcn primitive, with project styles applied.
5. **`app/editor/page.tsx`** — client-component page that owns sidebar `useState`, renders `<EditorNavbar />`, the floating `<ProjectSidebar />`, and a centered canvas placeholder.

### Untouched (per protected-foundation rule)

- `components/ui/*` (shadcn primitives) — not modified.
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css` — no changes needed; the root layout already provides the dark + font shell.
- No new `app/editor/layout.tsx` — the page is a single client component for now; layout can be extracted later if more chrome accumulates.

---

## Component Specs

### 1. `components/editor/editor-navbar.tsx`

- Marked `"use client"` — needs `isOpen`/`onToggle` props driven by parent state.
- Props: `{ isOpen: boolean; onToggle: () => void }`.
- Fixed-height (`h-14`), full width, `bg-base`, bottom border (`border-b border-surface-border`).
- Three-section layout using flex:
  - **Left:** `Button` (`variant="ghost"`, `size="icon-sm"`) with toggle icon. Use `PanelLeftOpenIcon` when `isOpen === true`, `PanelLeftCloseIcon` when `isOpen === false` (lucide-react@1.x `Icon`-suffix API).
  - **Center:** reserved placeholder (`<div />` or a `Logo` text mark — minimal, no new feature).
  - **Right:** empty `div` per spec.
- Use project tokens only (`bg-base`, `border-surface-border`, text uses default `text-copy-primary`). No raw hex.

### 2. `components/editor/project-sidebar.tsx`

- Marked `"use client"` — controlled by parent's `isOpen` state.
- Props: `{ isOpen: boolean; onClose: () => void }`.
- Floats above the canvas (does not push page content): `fixed left-0 top-14 bottom-0 z-40` (sits below the navbar at `top-14`, navbar is `h-14`).
- Width: `w-72` (consistent with the floating-sidebar pattern in `ui-context.md`).
- Surface: `bg-base/95 backdrop-blur-md` with `border-r border-surface-border` (floating-overlay styling from ui-context).
- Slides in from the left: when `isOpen === false`, render with `-translate-x-full` + `transition-transform duration-200`; when `true`, `translate-x-0`.
- Header row: `Projects` title (use `text-copy-primary`, `text-sm font-medium`) + close button on the right (`Button` `variant="ghost"` `size="icon-sm"` with `XIcon`).
- Body: shadcn `Tabs` (default horizontal variant) with two `TabsTrigger`s — "My Projects" / "Shared". Each `TabsContent` shows a minimal empty-state placeholder (e.g. a muted `text-copy-muted` line: "No projects yet").
- Footer: full-width `Button` (`variant="default"`) with `PlusIcon` and label "New Project", pinned to the bottom via `mt-auto` inside a flex column.

### 3. `components/editor/dialog.tsx` — Dialog pattern wrapper

- Re-exports shadcn `Dialog`, `DialogTrigger`, `DialogClose`, `DialogHeader`, `DialogTitle`, `DialogDescription` unchanged from `@/components/ui/dialog`.
- Wraps `DialogContent` and `DialogFooter` with project-styled defaults applied via `className` override (preserves the underlying primitive):
  - `DialogContent` — default `className` adds `rounded-3xl` (overrides the shadcn default `rounded-xl`) and `bg-base` (per ui-context: "centered overlay, rounded-3xl, dark background with backdrop blur"). The shadcn `DialogOverlay` already provides backdrop blur; we keep that.
  - `DialogFooter` — default `className` keeps the existing muted background, no override needed.
- Exports a typed `EditorDialog` namespace with: `Root`, `Trigger`, `Content`, `Header`, `Title`, `Description`, `Footer`, `Close`. The `Content` and `Footer` accept the same props as shadcn's but with project-styled defaults applied first (caller `className` still wins via `cn()` merge).
- Future dialogs import from `@/components/editor/dialog` so style updates stay in one place.

### 4. `components/editor/index.ts` — barrel

```ts
export { EditorNavbar } from "./editor-navbar";
export { ProjectSidebar } from "./project-sidebar";
export * as EditorDialog from "./dialog";
```

### 5. `app/editor/page.tsx` — editor route

- Marked `"use client"` — owns the `useState<boolean>` for sidebar open/close and a second piece of state for the future AI sidebar (out of scope to render now).
- Default `isOpen = true` so the sidebar is visible on first load.
- Layout structure (top to bottom):
  - `<EditorNavbar isOpen={isOpen} onToggle={() => setIsOpen(o => !o)} />` — fixed at top via its own internal styling.
  - `<ProjectSidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />` — fixed left, floating.
  - `<main>` — flex-1, centered canvas placeholder. Use `flex items-center justify-center` and a `text-copy-muted` text node like "Canvas" so the page isn't empty. Background `bg-base`. Lives behind the sidebar in the z-stack (sidebar is `z-40`); no explicit `z` on `main` needed.
- The `<html>` + `<body>` shell still comes from `app/layout.tsx` (no `app/editor/layout.tsx` for now).
- No auth check, no route protection stub yet — that's deferred until Clerk is set up.

---

## Critical files referenced (read-only, not modified)

- `app/globals.css` — source of all utility classes (`bg-base`, `text-copy-primary`, `border-surface-border`, `rounded-3xl`).
- `components/ui/button.tsx` — `Button` (variants: `default`, `ghost`; sizes: `icon-sm`).
- `components/ui/tabs.tsx` — `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.
- `components/ui/dialog.tsx` — underlying primitive re-exported by the wrapper.
- `lib/utils.ts` — `cn()` helper (used in the dialog wrapper to merge default + caller className).
- `.claude/context/ui-context.md` — design rules: floating sidebars, `rounded-3xl` modals, dark backdrop blur.

---

## Reused existing utilities

- `cn()` from `lib/utils.ts` — for className composition in the dialog wrapper.
- shadcn `Button` (with `asChild` available) for the navbar toggle and sidebar close button.
- shadcn `Tabs` for the My Projects / Shared switch.
- Icons from `lucide-react@1.38.0` using v1.x `Icon`-suffix names: `PanelLeftOpenIcon`, `PanelLeftCloseIcon`, `XIcon`, `PlusIcon`.

No new dependencies. No new tokens. No modifications to `components/ui/*`.

---

## Implementation order (each step is independently verifiable)

1. **`components/editor/dialog.tsx`** — wrapper. Read `components/ui/dialog.tsx` to confirm exports, then re-export with `rounded-3xl` `Content` default.
2. **`components/editor/editor-navbar.tsx`** — build, verify TypeScript compiles.
3. **`components/editor/project-sidebar.tsx`** — build, verify TypeScript compiles.
4. **`components/editor/index.ts`** — barrel.
5. **`app/editor/page.tsx`** — wire the components together with `useState` and a canvas placeholder.
6. **Static verification:** run `bunx tsc --noEmit` and `bun run lint` (oxlint) to catch type and lint errors. Boot the dev server and hit `/editor` to smoke-test the route (200, navbar + sidebar render, toggle works).

---

## Verification

Per the spec's "Check when done":

- [ ] `bunx tsc --noEmit` exits 0 — no TypeScript errors.
- [ ] `bun run lint` exits 0 — no lint errors.
- [ ] `bunx oxfmt --check components/editor/ app/editor/` clean.
- [ ] `components/editor/*` compiles standalone (no unused imports, no missing exports).
- [ ] Dialog wrapper preserves the shadcn API surface (every primitive re-exported, same prop types) and applies the project's `rounded-3xl` + dark-surface defaults.
- [ ] Dev server boots, `GET /editor` returns 200, the navbar renders with the toggle button, the sidebar is visible (default `isOpen = true`), and clicking the toggle slides the sidebar off-canvas.
- [ ] `progress-tracker.md` updated: this spec moved from "Next Up" to "Completed", and any new open questions logged.

---

## Out of scope (deferred to later specs)

- `app/editor/layout.tsx` (not needed yet — root `app/layout.tsx` covers the chrome; a route group can be added later if more editor-scoped providers accumulate).
- The right slide-over AI sidebar (ui-context mentions it; spec 02 only covers the left sidebar).
- Auth/ownership checks on the editor route (per progress-tracker "route protection stubs") — Clerk isn't set up yet.
- Real "New Project" action (button is wired to a no-op for now).
- Tabs content beyond empty placeholders.
- Any actual dialog instance using the new pattern (per spec: "Do not build actual dialogs yet").
