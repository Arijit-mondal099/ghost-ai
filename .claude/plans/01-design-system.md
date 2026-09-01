# Plan: Design System & shadcn/ui Foundation (Spec 01)

## Context

The Ghost AI codebase is scaffolded (Next.js 16.3.4 + React 19.2.8 + Tailwind v4) but has no design system or UI primitives yet. The product spec (`architecture-context.md`) declares `UI: Tailwind + shadcn/ui` and `ui-context.md` defines a dark-only design language using CSS custom property tokens mapped through `@theme inline`. This is the first implementation step — it establishes the foundation every later UI feature will build on (canvas, sidebars, dialogs, forms).

The current state:

- `app/globals.css` is a single line (`@import "tailwindcss";`) — no design tokens yet.
- No `components.json`, no `lib/`, no `components/`, no `components/ui/`.
- `tsconfig.json` `paths` already set to `"@/*": ["./*"]` (root-level, no `src/`).
- `package.json` is on Tailwind v4 via `@tailwindcss/postcss`. No `tailwind.config.*` file (v4 uses CSS-based config).
- The protected-component rule from `.claude/rules/dev-workflow.md` says: **never modify generated `components/ui/*` files**. Project-specific styling must live in app-level components.

**Intended outcome:** A working dark-theme design system — `cn()` helper, full set of design tokens, and seven foundational shadcn components — wired into the running app and ready for the canvas/sidebar/dialog work in subsequent specs.

## Approach

Use the shadcn CLI (`shadcn@^4.5.0`) to scaffold the design system against Tailwind v4. The CLI does three things for us: (1) writes `components.json` so future `add` commands are deterministic, (2) creates `lib/utils.ts` with the `cn()` helper, and (3) generates the seven components into `components/ui/`. We then hand-write the project's CSS token system into `app/globals.css` using `@theme inline` (Tailwind v4's CSS-first config) so that the shadcn components and our future app code share one theme. We do not edit any generated `components/ui/*` file — customization happens in app-level wrappers.

**Critical decision:** shadcn's default `init` writes a `:root`/`.dark` color system with HSL values (e.g. `--background`, `--foreground`, `--primary`). Our project tokens are different names (e.g. `--bg-base`, `--text-primary`, `--accent-primary`). To keep both systems working without conflicting:

- Run `shadcn init` to generate its default CSS variables block (shadcn components will reference `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `border-input`, etc.).
- Then **overwrite** the `:root` color values with the project tokens from `ui-context.md` aliased into shadcn's variable names. This keeps the shadcn-generated component classes working AND wires them to the project's dark palette.
- Add our additional project-specific tokens (`--bg-surface`, `--text-secondary`, `--border-default`, `--accent-primary`, etc.) for app-level use, mapped to Tailwind utilities through `@theme inline`.

This single globals.css is the only place the design system is defined. The shadcn components and our app code share it.

## Files to Create / Modify

### 1. `app/globals.css` — full rewrite

Replace the single line with:

```css
@import "tailwindcss";

/* Project design tokens — see .claude/context/ui-context.md */
:root {
  /* shadcn-compatible aliases (so generated components get the dark palette) */
  --background: #111111;
  --foreground: #eeeeee;
  --card: #191919;
  --card-foreground: #eeeeee;
  --popover: #191919;
  --popover-foreground: #eeeeee;
  --primary: #ffe0c2;
  --primary-foreground: #111111;
  --secondary: #222222;
  --secondary-foreground: #eeeeee;
  --muted: #2a2a2a;
  --muted-foreground: #717171;
  --accent: #222222;
  --accent-foreground: #eeeeee;
  --destructive: #e54d2e;
  --destructive-foreground: #eeeeee;
  --border: #201e18;
  --input: #201e18;
  --ring: #ffe0c2;
  --radius: 0.75rem;

  /* Project-specific tokens (referenced by app code via @theme inline below) */
  --bg-base: #111111;
  --bg-surface: #191919;
  --bg-elevated: #222222;
  --bg-subtle: #2a2a2a;
  --border-default: #201e18;
  --border-subtle: #484848;
  --text-primary: #eeeeee;
  --text-secondary: #b4b4b4;
  --text-muted: #717171;
  --text-faint: #3a3a3a;
  --accent-primary: #ffe0c2;
  --accent-primary-dim: rgba(255, 224, 194, 0.12);
  --accent-ai: #6457f9;
  --accent-ai-text: #8b82ff;
  --state-error: #e54d2e;
  --state-success: #34d399;
  --state-warning: #fbbf24;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-base: var(--bg-base);
  --color-surface: var(--bg-surface);
  --color-elevated: var(--bg-elevated);
  --color-subtle: var(--bg-subtle);
  --color-surface-border: var(--border-default);
  --color-subtle-border: var(--border-subtle);
  --color-copy-primary: var(--text-primary);
  --color-copy-secondary: var(--text-secondary);
  --color-copy-muted: var(--text-muted);
  --color-copy-faint: var(--text-faint);
  --color-brand: var(--accent-primary);
  --color-accent-dim: var(--accent-primary-dim);
  --color-ai: var(--accent-ai);
  --color-ai-text: var(--accent-ai-text);
  --color-error: var(--state-error);
  --color-success: var(--state-success);
  --color-warning: var(--state-warning);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-base text-copy-primary;
    font-family: var(--font-geist-sans), system-ui, sans-serif;
  }
}
```

### 2. `package.json` — new dependencies (via `bun add`)

Add as devDependencies:

- `shadcn@^4.5.0`
- `lucide-react@^1.11.0`

The shadcn CLI will additionally add (as runtime deps during `init`/`add`):

- `@radix-ui/react-dialog` (for Dialog)
- `@radix-ui/react-scroll-area` (for ScrollArea)
- `@radix-ui/react-slot` (for Button asChild)
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `tw-animate-css`

(Allow the shadcn CLI to install these; do not pin them manually.)

### 3. `lib/utils.ts` — created by `shadcn init`

Standard `cn()` helper:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

(Generated by the CLI — do not modify after creation.)

### 4. `components.json` — created by `shadcn init`

Will contain paths, base color, CSS variables, etc. Generated; do not modify after creation.

### 5. `components/ui/*` — generated, do NOT modify

After running `shadcn add`, the following files will be created:

- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/dialog.tsx`
- `components/ui/input.tsx`
- `components/ui/tabs.tsx`
- `components/ui/textarea.tsx`
- `components/ui/scroll-area.tsx`

All seven must remain unmodified per `.claude/rules/dev-workflow.md` "Protected Foundation Components."

## Execution Steps

1. **Install shadcn CLI and lucide-react as devDependencies:**

   ```bash
   bun add -d shadcn@^4.5.0 lucide-react@^1.11.0
   ```

2. **Run `shadcn init` non-interactively** to scaffold the foundation (writes `components.json`, `lib/utils.ts`, and a base `globals.css`). Use the default Next.js preset and accept CSS variables:

   ```bash
   bunx shadcn@latest init --base-color neutral --css-variables --yes
   ```

   If the CLI prompts for the `@/components` path or the `globals.css` path, answer `components/ui` and `app/globals.css` respectively. The `tsconfig.json` `paths` already sets `@/*` to `./*`, so `lib/utils` and `components/ui/button` will resolve correctly.

3. **Overwrite `app/globals.css`** with the design tokens from step 1 of the "Files to Create / Modify" section. The init command will have written a generic version; we replace it entirely with the project's token system above. This is the only file in the design system we author by hand.

4. **Add the seven shadcn components** in a single command:

   ```bash
   bunx shadcn@latest add button card dialog input tabs textarea scroll-area --yes
   ```

   This will install the required `@radix-ui/*` packages and write the seven files into `components/ui/`. Do not modify any of them after generation.

5. **Verify TypeScript compilation** — the project must typecheck cleanly:

   ```bash
   bun run typecheck
   ```

6. **Verify lint and format** — the husky pre-commit hook runs `oxlint` and `oxfmt --check`:

   ```bash
   bun run lint
   bun run fmt:check
   ```

   If shadcn's generated code triggers any oxlint rule, run `bun run lint:fix` and `bun run fmt` to auto-format. (Generated code is generally clean.)

7. **Smoke test the design system** — replace the contents of `app/page.tsx` temporarily with a small "kitchen sink" page that imports one component of each type to confirm the dark theme renders correctly with no light-mode bleed. After verification, revert `app/page.tsx` to its original `<div>Home</div>` (or leave the smoke test in place if preferred — the spec does not require a specific landing page).

8. **Update `.claude/context/progress-tracker.md`** per the AGENTS.md instruction: mark "Design system foundation" as completed, add the next planned feature unit (likely workspace layout / canvas) to "Next Up", and note the design tokens in "Architecture Decisions" if relevant.

9. **Commit** with a conventional-commits subject (lowercase, ≤100 chars, no trailing period) — e.g.:
   ```
   feat(design-system): add shadcn foundation and dark theme tokens
   ```

## Files NOT touched (deliberate)

- `app/layout.tsx` — already loads Geist fonts as CSS variables; no change needed.
- `app/page.tsx` — reverts to a placeholder after smoke test; not part of this spec.
- `tsconfig.json` — paths already correct.
- `postcss.config.mjs` — already uses `@tailwindcss/postcss`; no change.
- `.oxlintrc.json` / `.oxfmtrc.json` / `commitlint.config.js` / `.husky/*` — no change.
- Any `components/ui/*` file after generation — protected.

## Verification

End-to-end success criteria (from the spec's "Check when done"):

1. **All seven components import without errors** — `bun run typecheck` exits clean.
2. **`cn()` works properly** — verified by smoke test using `cn("p-4", condition && "bg-base")` patterns inside imported components.
3. **No default light styling appears** — render the smoke test page in `bun run dev` and confirm:
   - Page background is `#111111` (dark), not white.
   - Text is light (`#eeeeee`).
   - shadcn `<Button>` renders with cream-colored text on the dark surface.
   - `<Card>` uses `#191919` surface color, not default white.
   - `<Input>` border is `#201e18`, not default gray.
   - `<Dialog>` (triggered via `<DialogTrigger>`) opens with `rounded-3xl` dark surface and backdrop blur.
   - `<ScrollArea>` and `<Tabs>` use the dark token colors.
4. **Lint + format pass** — `bun run lint && bun run fmt:check` exit 0.
5. **Commit hook is green** — `bunx --no commitlint --edit <commit-msg-file>` accepts the message.

## Risks / Notes

- **shadcn init interactive prompts:** If the CLI does not accept `--yes`/`-y` to skip prompts, fall back to running it interactively and answering `components/ui` for components path and `app/globals.css` for CSS path. (The non-interactive form is documented above; interactive may be required on the first run.)
- **CSS variable names:** shadcn's default registry uses `--background`, `--foreground`, `--primary`, etc. We've aliased them to our project tokens. If a future shadcn component references a variable we didn't alias (e.g. `--chart-1`), add it to `:root` with a reasonable default from our palette.
- **No `tw-animate-css` import in globals.css:** Tailwind v4 + shadcn's current pattern uses `@import "tw-animate-css"` at the top. Add this import alongside `@import "tailwindcss";` if the generated components require animation utilities. The `shadcn add` step will install the package; verify the import is present after running init.
- **Pre-commit hook runs lint + fmt:check but not typecheck.** Type errors will only be caught at `bun run typecheck` or in CI. Run typecheck manually before committing.
