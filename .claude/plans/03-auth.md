# Spec 03 — Clerk Authentication Implementation Plan

## Context

The project (Ghost AI — a collaborative design canvas with AI generation) is past design-system and editor-chrome milestones. The current `/` route is a 5-line placeholder and the `/editor` route has no auth gate — any visitor can hit it. Spec 03 wires Clerk into the Next.js 16 app so the editor (and every other future route) requires a signed-in user, gives them a themed sign-in/sign-up flow, and surfaces a `UserButton` for profile/sign-out inside the editor.

`@clerk/nextjs@^7.8.3` is already on the uncommitted working tree and `.env.local` already has the test publishable + secret keys. What's missing: `@clerk/ui` (the theme package), `proxy.ts` (Next 16's renamed middleware), the two auth pages, the root-layout `ClerkProvider` wrap, the `/` redirect logic, and the editor-navbar `UserButton` slot.

## Resolved Decisions

| Decision                      | Choice                                                                                                    | Reason                                                                                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme import                  | `import { shadcn } from "@clerk/ui/themes"`                                                               | Project has `components.json` (shadcn installed). The Clerk skill explicitly mandates the `shadcn` theme for shadcn projects — `dark` would be a regression in visual coherence.                                                              |
| Appearance key                | `appearance={{ theme: shadcn, variables: {...} }}`                                                        | The skill uses `theme` (not `baseTheme`) for current SDK v7+. `variables` keys are the documented ones.                                                                                                                                       |
| `ClerkProvider` shape         | Wrap root layout directly; root layout becomes `async`                                                    | The d.ts shows `ClerkProvider` returns `Promise<React.JSX.Element>` — it's an async Server Component in v7. No client wrapper needed.                                                                                                         |
| Auth page layout              | Per-page `AuthShell` component (no `app/(auth)/layout.tsx`)                                               | Two pages share ~30 lines of identical two-panel JSX. Extracting a layout for a 30-line shell used twice is over-abstraction. One shared component imported by both pages keeps the design system consistent without forcing a route group.   |
| Sign-in/sign-up env vars      | Add `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` to `.env.local` | They don't exist yet. Spec says "use existing sign-in/sign-up env vars" — these are the names it means. `createRouteMatcher` in `proxy.ts` derives the public-route list from these same env vars so we have one source of truth.             |
| Sign-in / sign-up route shape | `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`                              | The `[[...]]` catch-all is required for Clerk's multi-step subroutes (e.g. `/sign-in/factor-one`).                                                                                                                                            |
| Proxy function                | `export default clerkMiddleware(...)` from `proxy.ts` at project root                                     | Next 16 renamed Middleware to Proxy (verified in `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). `clerkMiddleware` from `@clerk/nextjs/server` returns a `NextMiddleware`, which the `proxy.ts` default export accepts. |
| Auth shell dimensions         | Two-column grid `lg:grid-cols-2`, single-column below `lg`; left panel hidden via `hidden lg:flex`        | Spec: two-panel on large, form-only on small. No scroll-heavy layouts.                                                                                                                                                                        |
| `UserButton` placement        | Inside `EditorNavbar` right flex section, with `afterSignOutUrl="/sign-in"`                               | The right `<div className="flex items-center" />` slot is already present. After sign-out, return to `/sign-in` (matches spec's "Keep Clerk's default user menu intact" — only the post-logout destination is configured).                    |

## Files

### Create

- `proxy.ts` (project root) — `clerkMiddleware` with public-route matcher, default-deny everything else
- `app/sign-in/[[...sign-in]]/page.tsx` — server component rendering `<AuthShell><SignIn .../></AuthShell>`
- `app/sign-up/[[...sign-up]]/page.tsx` — same pattern with `<SignUp>`
- `components/auth/auth-shell.tsx` — `"use client"` presentational shell (logo + tagline + 3-item feature list left, centered form slot right)
- `components/auth/index.ts` — barrel re-export
- `lib/auth-appearance.ts` — `authAppearance` object: `{ theme: shadcn, variables: {...} }` mapping every color/font/radius to a `var(--...)` from `app/globals.css`

### Modify

- `app/layout.tsx` — import `ClerkProvider` and `shadcn` theme; make `RootLayout` `async`; wrap children in `<ClerkProvider appearance={...}>`
- `app/page.tsx` — server component calling `auth()` from `@clerk/nextjs/server`; redirect `/editor` if `userId`, else `/sign-in`
- `components/editor/editor-navbar.tsx` — add `UserButton` import + render in the right flex section
- `package.json` — add `@clerk/ui` to `dependencies` (via `bun add`)
- `.env.local` — add `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL`

### Reference (do not modify)

- `app/globals.css` — source of truth for CSS variables the appearance config references
- `components/ui/*` — protected shadcn primitives
- `lib/utils.ts` — `cn()` helper

## Implementation Steps (Dependency Order)

### 1. Install `@clerk/ui` and add env vars

```bash
cd D:/code/build-with-claude-code/ghost-ai
bun add @clerk/ui
```

Then append to `.env.local`:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

**Verify:** `bun pm ls | grep "@clerk/ui"` resolves.

### 2. Create `lib/auth-appearance.ts`

Single source of truth for Clerk appearance across `ClerkProvider`, `<SignIn>`, `<SignUp>`, `<UserButton>`. Every color/radius references a `var(--...)` from `globals.css` — no hex.

```ts
import { shadcn } from "@clerk/ui/themes";

import type { Appearance } from "@clerk/types";

export const authAppearance: Appearance = {
  theme: shadcn,
  variables: {
    colorPrimary: "var(--accent-primary)",
    colorBackground: "var(--bg-base)",
    colorInputBackground: "var(--bg-surface)",
    colorText: "var(--text-primary)",
    colorTextSecondary: "var(--text-secondary)",
    colorInputText: "var(--text-primary)",
    colorNeutral: "var(--text-muted)",
    colorDanger: "var(--state-error)",
    colorSuccess: "var(--state-success)",
    colorWarning: "var(--state-warning)",
    colorBorder: "var(--border-default)",
    colorMutedBackground: "var(--bg-subtle)",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans)",
  },
  elements: {
    card: "bg-transparent shadow-none",
    formButtonPrimary: "bg-brand text-base hover:opacity-90",
    formFieldInput: "bg-surface border-surface-border text-copy-primary",
    footerActionLink: "text-brand hover:opacity-80",
    socialButtonsBlockButton: "bg-surface border-surface-border text-copy-primary",
    dividerLine: "bg-surface-border",
    dividerText: "text-copy-muted",
    identityPreview: "bg-surface",
    formFieldLabel: "text-copy-secondary",
  },
};
```

If `@clerk/types` is not directly resolvable (it's a transitive), use an inline structural type instead of `Appearance`.

### 3. Create `components/auth/auth-shell.tsx`

Presentational, `"use client"` (because it will wrap Clerk client components in the children slot), no business logic, no auth state — just layout.

```tsx
"use client";

import type { ReactNode } from "react";

import { SparklesIcon } from "lucide-react";

const FEATURES = [
  "Real-time AI canvas",
  "Project workspaces",
  "Multiplayer collaboration",
] as const;

type AuthShellProps = { children: ReactNode };

function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-dvh w-full bg-base text-copy-primary lg:grid-cols-2 grid-cols-1">
      <aside className="hidden flex-col justify-between border-r border-surface-border p-10 lg:flex">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-5 text-brand" />
          <span className="text-sm font-medium tracking-tight">Ghost AI</span>
        </div>

        <div className="max-w-sm space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight text-copy-primary">
            Think out loud, ship out loud.
          </h1>
          <p className="text-sm text-copy-secondary">
            A workspace where AI agents and humans build together.
          </p>
          <ul className="space-y-2 text-sm text-copy-muted">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-brand" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-copy-faint">By continuing you agree to our terms.</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

export { AuthShell };
export type { AuthShellProps };
```

### 4. Create `components/auth/index.ts`

```ts
export { AuthShell, type AuthShellProps } from "./auth-shell";
```

### 5. Create `app/sign-in/[[...sign-in]]/page.tsx`

```tsx
import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth";
import { authAppearance } from "@/lib/auth-appearance";

function SignInPage() {
  return (
    <AuthShell>
      <SignIn appearance={authAppearance} routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </AuthShell>
  );
}

export default SignInPage;
```

### 6. Create `app/sign-up/[[...sign-up]]/page.tsx`

```tsx
import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth";
import { authAppearance } from "@/lib/auth-appearance";

function SignUpPage() {
  return (
    <AuthShell>
      <SignUp appearance={authAppearance} routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthShell>
  );
}

export default SignUpPage;
```

### 7. Create `proxy.ts` at the project root

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return;
  }
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### 8. Modify `app/layout.tsx` — wrap with `ClerkProvider`

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ghost AI",
  description: "Collaborative AI design canvas",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

`<SignIn>`, `<SignUp>`, `<UserButton>` each pass `appearance={authAppearance}` per-instance, so the provider itself stays unopinionated. (Cleaner: no `theme` duplication, and per-component `elements` overrides still apply.)

### 9. Modify `app/page.tsx` — auth-state redirect

```tsx
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/editor");
  }

  redirect("/sign-in");
}

export default Home;
```

### 10. Modify `components/editor/editor-navbar.tsx` — add `UserButton`

Insert the `UserButton` import and render it in the right section:

```tsx
"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { authAppearance } from "@/lib/auth-appearance";

type EditorNavbarProps = {
  isOpen: boolean;
  onToggle: () => void;
};

function EditorNavbar({ isOpen, onToggle }: EditorNavbarProps) {
  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-surface-border bg-base px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={isOpen}
        >
          {isOpen ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
        </Button>
      </div>
      <div className="flex items-center" />
      <div className="flex items-center">
        <UserButton appearance={authAppearance} afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}

export { EditorNavbar };
export type { EditorNavbarProps };
```

The middle empty `<div />` is preserved (per the existing 3-section flex layout). Only the right section gains content.

### 11. Update `.claude/context/progress-tracker.md`

Mark spec 03 complete, list new files, add an Architecture Decision noting the theme choice, and a Session Note that `proxy.ts` (not `middleware.ts`) is used because Next 16 renamed Middleware to Proxy.

## Verification

Run in order from project root:

1. **Type check** — `bun run typecheck` (no errors).
2. **Lint** — `bun run lint` (clean; no `zinc-*` classes).
3. **Format check** — `bun run fmt:check` (clean — though the pre-existing drift in `ship-feature.md` and `02-editor.md` may still be flagged; leave those alone per surgical-changes rule).
4. **Build** — `bun run build` (must pass; exercises proxy bundling and the async `RootLayout`).
5. **Dev server smoke** — `bun run dev`:
   - Visit `http://localhost:3000/` while signed-out → redirect to `/sign-in`.
   - `/sign-in` renders two-panel layout (logo + tagline + 3-item list left, Clerk form right). Below `lg` breakpoint, left panel is gone.
   - Sign in with a Clerk test account → land on `/editor`.
   - Editor navbar right section shows user avatar. Clicking it opens the default Clerk user menu.
   - Sign out from the menu → land on `/sign-in`.
   - Direct visit to `/sign-up` → two-panel layout with Clerk sign-up form.
   - Direct visit to `/editor` while signed-out → bounced to `/sign-in` (proxy middleware).
6. **No hardcoded colors** — `grep -rE "#[0-9a-fA-F]{3,8}|zinc-|slate-|gray-|neutral-" components/auth/ lib/auth-appearance.ts app/sign-in app/sign-up proxy.ts` returns zero matches.
7. **Spec checklist** — `proxy.ts` exists at root; only `/sign-in(.*)` and `/sign-up(.*)` are public; auth pages use CSS variables only; `ClerkProvider` wraps root; `bun run build` passes.

## Risks

1. **`Appearance` type import path.** `@clerk/types` is a transitive dep of `@clerk/react`. If TypeScript can't resolve it, swap the type annotation for an inline structural shape and the rest of the file is unchanged.
2. **`ClerkProvider` requires async layout.** Easy to miss — the d.ts returns `Promise<React.JSX.Element>`. Forgetting `async` on `RootLayout` causes a type error at build time.
3. **Proxy/Middleware confusion in v7 docs.** Some Clerk v7 examples still show `middleware.ts`. This project must use `proxy.ts` per Next 16 convention. The function inside is still `clerkMiddleware` from `@clerk/nextjs/server` — only the filename changes.
4. **Catch-all `[[...sign-in]]` is required.** Without the optional catch-all, Clerk's multi-step subroutes (factor-one, verify-email-address, etc.) 404.
5. **The `shadcn` theme assumes shadcn classes are present.** It maps Clerk's components onto shadcn's CSS variable namespace. Since `globals.css` already declares the shadcn alias names (`--background`, `--primary`, etc.) in `:root` and `.dark`, the theme will pick them up. No additional CSS import is needed.
6. **Route protection and `/editor`.** The proxy middleware redirects unauthenticated users on initial document load, but on a client-side navigation to `/editor` (e.g., from a future internal link), `auth()` is not re-evaluated. Acceptable per spec — the middleware is the gate. If stronger guarantees are needed later, add `await auth()` + `redirect("/sign-in")` to `app/editor/page.tsx`. Out of scope for spec 03.
