# Authentication

Built on Clerk (`@clerk/nextjs` 7.x, `@clerk/ui` theme).

## Middleware (`proxy.ts`)

Next 16 renamed middleware to `proxy.ts`. This repo uses `clerkMiddleware`:

```ts
isPublicRoute = ["/sign-in(.*)", "/sign-up(.*)", "/", "/privacy(.*)", "/terms(.*)"];
// else: auth.protect()  (default-deny)
```

Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, image extensions; always runs on `/api` and `/trpc`.

## Pages

- `app/sign-in/[[...sign-in]]/page.tsx` — `<SignIn appearance routing="path" path="/sign-in" signUpUrl="/sign-up">` inside `AuthShell` ("Welcome back").
- `app/sign-up/[[...sign-up]]/page.tsx` — `<SignUp ...>` ("Get started") + Terms/Privacy consent links.
- `app/page.tsx` — server gate: signed in → `redirect("/editor")`, else `<LandingPage/>`.
- `components/auth/auth-shell.tsx` — two-panel shell (`title/sub/footer/children`) + testimonial panel. `lib/auth-appearance.ts` applies the Clerk `shadcn` theme with project tokens (no hardcoded colors).

## Identity & access

- `lib/api/auth.ts` → `requireUserId()`: reads Clerk `auth()`, throws `HttpError 401 UNAUTHENTICATED` when null. Used by every API route.
- `lib/project-access.ts`:
  - `getCurrentIdentity()` → `{ userId, email }` (all verified emails, lowercased) or `null`.
  - `getAccessibleProject(roomId, identity)` → project if `ownerId == userId` **or** collaborator row matches any verified email. Collapses 404 + 403 into `null` → renders `<AccessDenied/>` (prevents ID enumeration).
- `app/editor/[roomId]/page.tsx` — identity null → `redirect("/sign-in")`; project null → `<AccessDenied/>`; else computes `isOwner` and renders the workspace.
- `POST /api/liveblocks-auth` — verifies `getAccessibleProject`, ensures the Liveblocks room, then `identifyUser({ userId, userInfo: { name, avatar, color } })`. Tokens are per-room and short-lived (`Cache-Control: no-store`).

## Roles

- **Owner**: single Clerk `userId` per project. Can rename/delete/invite/remove, full canvas + AI + specs.
- **Collaborator**: rows in `ProjectCollaborator` keyed by email (`@@unique[projectId, email]`). Can edit canvas, trigger AI, view/download specs. Cannot rename/delete/invite.
- No enterprise tiers (out of scope).
