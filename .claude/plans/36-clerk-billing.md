# Plan 36 — Clerk Billing with project limits

Source spec: `.claude/context/specs/36-clerk-billing.md`
Status: approved — user locked both open questions on 2026-09-10.

## Locked decisions

1. **Grandfather PATCH scope (simple, recommended):** while `ownedCount > limit` —
   allow viewing, block ALL creates, block ALL PATCH/edit mutations on owned
   projects, always allow DELETE. No ordering rule, no "excess project"
   determination. Normal behavior resumes once `ownedCount <= limit`.
2. **403 payload (flat inside `error`):**
   `{ error: { code: "PLAN_LIMIT_EXCEEDED", message, currentPlan, limit, upgradeTo } }`.
   All billing metadata stays inside `error`; existing API contract preserved.

## Clerk API surface (verified against installed `@clerk/nextjs@^7.8.3`)

- `import { PricingTable } from "@clerk/nextjs"` — auto-renders Dashboard plans
  (`free` / `pro` / `pro_max`) + in-app checkout drawer + manage actions.
- Server: `const { has } = await auth(); has({ plan: "pro" })`
  (`CheckAuthorizationFromSessionClaims`, session-claims based, no network).
- `lib/billing.ts` takes a structural `(options: { plan: string }) => boolean`
  and call sites wrap: `getPlan((o) => has(o))` — avoids generic-arity friction.
- `upgradeTo`: free → `pro`, pro → `pro_max`, pro_max → `pro_max`
  (spec's literal `"pro"` holds for the common free case).

## Changes

1. **`lib/billing.ts` (new, client+server safe, no `server-only`)** —
   `PLAN_PROJECT_LIMITS`, `PlanSlug`, `DEFAULT_PLAN`, `PLAN_LABELS`,
   `getPlan(has)`, `getProjectLimit`, `canCreateProject`,
   `getUpgradeTo`, `planLimitExceededBody(plan)` (403 payload builder),
   placeholder capability hooks (`canUseAiGeneration`, `canUseAdvancedSpecs`,
   `canInviteCollaborator`, `getAnalyticsTier`) with no numbers at call sites.
2. **`lib/api/responses.ts`** — `forbidden(message, details?)` spreads optional
   details into `error` (flat payload per decision 2). Existing callers unchanged.
3. **`POST /api/projects`** — after auth + validation: resolve plan, count owned
   (`prisma.project.count({ where: { ownerId } })`), `count >= limit` → 403,
   no create.
4. **`PATCH /api/projects/[projectId]`** — after ownership check: requester's
   `ownedCount > limit` → same 403, no update. `GET`/`DELETE` untouched
   (delete always allowed so users can get back under the limit).
5. **`lib/projects-data.ts`** — `getBillingSummaryForCurrentUser()` server helper
   returning `{ plan, ownedCount, limit }` (plan default `free` when signed out).
6. **`app/pricing/page.tsx` (new)** — protected server route (proxy default-deny;
   signed-out → `redirect("/sign-in")`), `<PricingTable appearance={authAppearance}
/>` on dark tokens + loading/error fallbacks.
7. **`components/editor/editor-navbar.tsx`** — Pricing/Upgrade ghost link
   (`/pricing`) next to `UserButton`, visible on home + workspace.
8. **`components/editor/project-sidebar.tsx`** — optional `billing` prop
   (`{ plan, ownedCount, limit }`), presentational `SidebarBillingFooter`
   (badge + usage + progress + Upgrade link) above `New Project` in both
   `inline` and floating variants; skeleton/error fallbacks never break the list.
9. **`app/editor/layout.tsx` + `workspace-shell.tsx`** — thread `billing` prop
   layout → shell → sidebar.
10. **`components/editor/upgrade-plan-dialog.tsx` (new)** — `EditorDialog`
    upgrade modal (limit explanation, current plan, next option, Upgrade →
    `/pricing`, Cancel dismisses); barrel export.
11. **`hooks/use-project-actions.ts`** — `readErrorDetails()` parses
    `code/currentPlan/limit/upgradeTo` from `error`; `submitCreate` opens the
    upgrade modal on `PLAN_LIMIT_EXCEEDED`, keeps dialog state, never creates.

## Verification

- `bunx next typegen` → `bun run typecheck` → `bun run lint` → `bun run build`.
- Matrix: free 3rd create succeeds / 4th 403 + modal; pro/pro_max via stubbed
  plan + count; shared projects don't count; downgrade → view + delete allowed,
  create/edit 403 until under limit; `/pricing` themed + linked; manage via Clerk;
  loading/error/signed-out states everywhere.
