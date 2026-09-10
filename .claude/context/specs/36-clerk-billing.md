# Spec 36 — Clerk Billing with project limits (Free 3 / Pro 100 / Pro Max 1000)

Add billing using **Clerk Billing** (already enabled in the Clerk Dashboard).
Do not build a custom Stripe/payment system. Use Clerk's recommended
billing APIs/components wherever applicable.

Clerk plan slugs (source of truth, already configured):

- `free`
- `pro` ($20/month)
- `pro_max` ($100/month)

## Plans & limits

| Plan    | Projects (owned only) | AI / spec generation | Collaboration | Analytics    |
| ------- | --------------------- | -------------------- | ------------- | ------------ |
| Free    | max 3                 | basic                | basic         | basic        |
| Pro     | max 100               | higher limits        | more capacity | advanced     |
| Pro Max | max 1,000             | highest limits       | highest       | all advanced |

Rules:

- Do NOT make Pro or Pro Max unlimited.
- Project cap counts **owned projects only** (`ownerId = userId`).
  Shared/collaborator projects never count toward the cap.
- Do NOT invent arbitrary numeric limits for AI generations, specs, or
  collaborators — those values are not finalized. Structure entitlement
  checks so they can be configured later (e.g. capability hooks returning
  allow/deny + limit placeholder, single config module).
- Clerk is the source of truth for the active plan. No local user table,
  no billing DB migration.

## Entitlement model

- Single config module (e.g. `lib/billing.ts`):
  `PLAN_PROJECT_LIMITS = { free: 3, pro: 100, pro_max: 1000 }` plus
  `getPlan(auth)`, `getProjectLimit(plan)`, `canCreateProject(count, plan)`.
- Resolve the plan server-side via Clerk auth (`auth().has({ plan: ... })`
  or the documented Billing `has()` equivalent for `@clerk/nextjs@^7.8.3`).
  Default unknown/missing plan to `free`.
- Future capabilities (AI/spec/collab/analytics tiers) go through the same
  module as named checks — no hardcoded numbers at call sites.

## Server-side enforcement

- `POST /api/projects` must, after `requireUserId()` and body validation:
  1. resolve plan,
  2. `count` owned projects (`prisma.project.count({ where: { ownerId } })`),
  3. if `count >= limit` → reject with `403 { error: { code: "PLAN_LIMIT_EXCEEDED",
message } }` including `currentPlan`, `limit`, `upgradeTo: "pro"`.
     Do not create the project.
  4. Preserve the existing `{ error: { code, message } }` contract from
     `lib/api/responses.ts`.
- UI bypass must not succeed — the API is the enforcement boundary.
- Downgrade / over-limit (e.g. Pro 50 projects → Free): never auto-delete.
  Grandfather existing projects as read-only: block `POST` (new creates)
  and block mutating existing excess projects (`PATCH`/workspace edits)
  while `ownedCount > limit`; viewing stays allowed. Deleting down under
  the limit restores write access.

## UI

### `/pricing` (protected)

- New protected route rendering Clerk's `<PricingTable />` for
  `free` / `pro` / `pro_max`, themed via the existing `authAppearance`
  (dark tokens only, no hardcoded hex).
- `proxy.ts` protects it like `/editor`. Handle loading, error, and
  signed-out states (signed-out redirects to `/sign-in`).

### Navbar

- Add a Pricing/Upgrade entry point (e.g. `rightActions` slot or near
  `UserButton` in `EditorNavbar`). Routes to `/pricing`. Follows existing
  `bg-base`, `border-surface-border`, `text-copy-*` tokens.

### Sidebar bottom

- Above/below the existing `New Project` footer in `ProjectSidebar`
  (both `inline` and floating variants): plan badge + usage
  (e.g. `Free • 2/3 projects`) + progress indicator + `Upgrade` button
  linking to `/pricing`.
- Props flow from the server layout (owned count + plan); client component
  stays presentational. Loading skeleton + error fallback that never breaks
  the project list.

### Upgrade modal (over-limit)

- When `submitCreate` receives `PLAN_LIMIT_EXCEEDED`:
  - keep the user on the current page, keep the create dialog state,
  - open an upgrade dialog (`EditorDialog`, `rounded-3xl`, dark + blur):
    explains the Free limit of 3, shows current plan (`Free`), shows the
    next upgrade option (`Pro`), `Upgrade` button → `/pricing`,
    `Cancel` dismisses. The 4th project is never created.

### Manage subscription

- Use Clerk's built-in management surface (PricingTable manage/subscribe
  actions and/or UserProfile billing section via `UserButton`). No custom
  billing portal, no extra dependencies.

## Constraints

- Reuse existing Clerk setup (`ClerkProvider`, `proxy.ts`, `authAppearance`).
- Dark-only theme: CSS vars in `globals.css` mapped via `@theme inline`
  (`bg-base`, `text-copy-primary`, `border-surface-border`, `bg-accent-dim`,
  etc.). shadcn/ui primitives from `components/ui/`, Lucide stroke icons
  only. No raw `zinc-*` or hex.
- No unrelated changes. Preserve existing project/auth/canvas behavior.

## Check When Done

- Free user with < 3 owned projects can create; 3rd succeeds, 4th is
  blocked server-side (403 `PLAN_LIMIT_EXCEEDED`) and shows the upgrade
  modal with current plan + Pro upgrade + button to `/pricing`.
- Pro user can create up to 100, Pro Max up to 1,000 (verified via plan
  mock/stub + count, not by creating 1,000 rows).
- Shared projects do not increment the owner's cap.
- Over-limit after downgrade: existing projects visible but read-only;
  create/edit blocked until under limit; delete restores access.
- `/pricing` renders the Clerk table themed dark; navbar + sidebar-bottom
  entry points route there; manage-subscription action works via Clerk.
- Loading, error, and unauthenticated states handled on all new surfaces.
- `bun run typecheck`, `bun run lint`, `bun run build` pass.
