# Plan 38 — Logged-out landing / marketing page at `/`

Source spec: `.claude/context/specs/38-landing-page.md`
Status: proposed — awaiting approval (no code yet).

## Locked decisions

1. **Pricing static (recommended):** placeholder cards mirroring spec 36 tiers, all CTAs → `/sign-up`. No `PricingTable`, no `lib/billing.ts`, no API.
2. **Route `/` (keep redirect):** server `page.tsx` checks `auth()` — `userId` → `redirect("/editor")`, else render landing. `proxy.ts` adds `/` to public matcher.
3. **Sections:** navbar, hero + schematic visual, how-it-works, features, pricing, testimonials, FAQ, CTA band, footer. No logo cloud.
4. **Signature schematic + real copy:** hero visual is static divs/SVG reusing `NODE_COLORS` + `.ghost-draft-sweep`. Real draft copy, `COPY-DRAFT` header on testimonials.

## Changes

1. **`proxy.ts`** — add `"/"` to `createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/"])`. Nothing else changes; `/editor`, `/api/*` stay default-deny.
2. **`app/page.tsx`** — keep async server component. `auth()` → redirect `/editor` if signed in, else `<LandingPage />`. Export `metadata` (title `Ghost AI — Describe systems. Design together. Ship the spec.`, description + OG). No `"use client"`.
3. **`components/landing/landing-page.tsx` (new)** — server composition: `<LandingNavbar />` + `<main>` (hero, how, features, pricing, testimonials, faq, cta) + `<LandingFooter />`. Shared container `max-w-6xl mx-auto px-6`, section rhythm `py-20 md:py-28`.
4. **`components/landing/landing-navbar.tsx` (new, client for mobile menu only)** — sticky `bg-base/80 backdrop-blur-md border-b border-surface-border`. `GhostIcon` + wordmark, anchor links `#features/#how/#pricing/#testimonials/#faq`, `Sign in` ghost → `/sign-in`, `Get started` primary → `/sign-up`. Mobile hamburger `useState` toggle.
5. **`components/landing/hero.tsx` + `hero-schematic.tsx` (new, server)** — copy left (mono eyebrow `text-ai-text`, H1, sub, dual CTA, micro-proof mono row), schematic right: 4 mini nodes from `types/canvas.ts` `NODE_COLORS`, SVG edge + arrow, presence dots + `Ghost is drafting…` badge, `.ghost-draft-sweep`. `aria-hidden` on visual.
6. **`components/landing/how-it-works.tsx`, `features.tsx` (new, server)** — how: `id="how"`, 3 sequenced cards `01/02/03` with `Sparkles/Users/FileText` icons; features: `id="features"`, 6 cards with `h-8 w-8` tiles in `bg-accent-dim`/`text-brand`. All `bg-surface border-surface-border rounded-2xl`.
7. **`components/landing/pricing.tsx`, `testimonials.tsx`, `faqs.tsx`, `cta-band.tsx`, `landing-footer.tsx` (new)** — pricing `id="pricing"` static 3 cards (Pro highlighted `border-brand/50` + badge), footnote mono; testimonials `id="testimonials"` 3 static cards with initials avatars; faqs `id="faq"` via shadcn `Accordion` (`bunx shadcn@latest add accordion` if `components/ui/accordion.tsx` missing — never hand-roll); cta-band `rounded-3xl bg-elevated` with `// READY WHEN YOU ARE` eyebrow; footer `border-t border-surface-border` 3-col + bottom row.
8. **`components/landing/index.ts` (new)** — barrel re-exports. No edits to `components/ui/*`, `globals.css`, `types/canvas.ts`, editor, canvas, or API routes.

## Verification

- `bunx next typegen` → `bun run typecheck` → `bun run lint` → `bun run build`.
- Manual: logged-out `GET /` 200 with all 9 sections; logged-in `/` → `/editor`; `/editor` logged-out still 307 to `/sign-in`.
- Grep `components/landing/` for `#[0-9a-f]` / `zinc-` → empty; icons are Lucide stroke; 360px no overflow; accordion keyboard OK; reduced-motion disables sweep.
- Update `.claude/context/progress-tracker.md` after landing implementation.
