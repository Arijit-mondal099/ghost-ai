# Spec 38 — Logged-out landing / marketing page at `/`

Build a dark-only marketing landing page for logged-out users at `/`. Today `app/page.tsx` redirects signed-out → `/sign-in`. After this spec, signed-in users still redirect to `/editor`, logged-out users see the landing (no redirect to `/sign-in`).

Grill decisions (locked):

- Pricing = static placeholders only (no checkout, no entitlement logic). Copy mirrors spec 36 tiers (Free 3 / Pro 100 / Pro Max 1000) but buttons link to `/sign-up`. Respects project-overview out-of-scope for billing.
- Route = landing at `/`, keep signed-in redirect.
- Extra sections approved: How-it-works (prompt → canvas → spec) + product visual in hero + bottom CTA band.
- Design signature = schematic canvas preview echoing the editor (nodes/edges motif, drafting-desk identity), restrained motion, real copy (no lorem).

## Implementation

### 1. Route + auth (`app/page.tsx`, `proxy.ts`)

- `app/page.tsx` stays an async server component. `auth()` from `@clerk/nextjs/server`: if `userId` → `redirect("/editor")`, else render `<LandingPage />`.
- `proxy.ts`: add `/` to the public-route matcher (e.g. `createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/"])`). `/editor`, `/api/*`, `/pricing` stay protected. Verify logged-out `GET /` returns 200 (not 307), logged-in `/` still 307s to `/editor`.
- Metadata in `app/page.tsx` or layout: title `Ghost AI — Describe systems. Design together. Ship the spec.`, description for SEO. No client JS for the route shell.

### 2. Component structure (`components/landing/`)

Server components by default; `"use client"` only where needed (mobile nav, FAQ accordion). New dir `components/landing/` + barrel `index.ts`:

- `landing-navbar.tsx` — sticky top bar `h-14/h-16`, `bg-base/80 backdrop-blur-md border-b border-surface-border`. Left: Ghost mark (Lucide `GhostIcon` + `Ghost AI` wordmark). Center (desktop): anchor links Features / How it works / Pricing / Testimonials / FAQ. Right: `Sign in` ghost → `/sign-in`, `Get started` primary (`bg-brand text-black` or existing primary token) → `/sign-up`. Mobile: hamburger → slide-down menu (client). No `UserButton` here.
- `hero.tsx` — centered stack like the Avenor reference (dark theme): top pill badge, centered H1 with mixed `text-copy-primary` / `text-copy-muted` emphasis, centered sub, centered dual CTAs (`Get started` → `/sign-up`, `Learn more` → `#how`), micro-proof mono row. Full-width `hero-schematic.tsx` below, then trusted-by strip (`Trusted by leading teams worldwide` + 5-cell bordered wordmark grid).
- `hero-schematic.tsx` — app-window mock echoing the editor (NOT live React Flow): outer `bg-accent-dim` band, inner `bg-surface rounded-2xl` window with top search bar, 3-column body (mini nav / 4 `NODE_COLORS` nodes + Ghost drafting badge with `.ghost-draft-sweep` / spec-preview rail), `aria-hidden`, reduced-motion respected. Trusted-by wordmarks are plain text (no external logos).
- `how-it-works.tsx` — `id="how"`, 3 steps (numbering IS a sequence here, allowed): `01 Prompt` (`SparklesIcon`), `02 Refine together` (`UsersIcon`), `03 Export spec` (`FileTextIcon`). Each: title + 1-line description + mono hint (`/prompt`, `/invite`, `/spec.md`). Cards `bg-surface border-surface-border rounded-2xl`.
- `features.tsx` — `id="features"`, 6 cards max (grid `md:2 lg:3`): Realtime canvas (`RadioIcon`), AI architecture generation (`BotIcon`), Starter templates (`LayoutTemplateIcon`), Live presence (`MousePointer2Icon`), One-click spec (`FileDownIcon`), Project sharing (`Share2Icon`). Icon tile `h-8 w-8` in `bg-accent-dim` + `text-brand` per ui-context. No emojis.
- `pricing.tsx` — `id="pricing"`, static only. 3 cards mirroring spec 36 limits: Free (3 owned projects, basic AI/collab), Pro ($20/mo, 100 owned), Pro Max ($100/mo, 1000 owned). Middle card highlighted (`border-brand/50`, `Most popular` badge). All buttons → `/sign-up` (`Get started` / `Start free`). Footnote mono: `Prices shown for reference. Checkout lives in the app.` No `PricingTable`, no `lib/billing.ts` import, no API calls.
- `testimonials.tsx` — `id="testimonials"`, 3 static cards (`bg-surface border-surface-border rounded-2xl`): quote (`text-copy-secondary`), name/role (`text-copy-primary` / `text-copy-muted`), initials avatar (no `next/image`, no external faces). Draft real-sounding systems-engineering quotes; mark file header `COPY-DRAFT — replace with real users before launch`.
- `faqs.tsx` — `id="faq"`, shadcn `Accordion` (add via CLI if missing — do not hand-roll). 5–6 Qs: Do I need to know system design? How does realtime collab work? What does AI generate? Where are specs stored? Is there a free plan? Can I invite non-teammates? Answers 1–2 sentences, plain verbs, sentence case.
- `cta-band.tsx` — full-width panel `bg-elevated border border-surface-border rounded-3xl` with dotted-rail + mono eyebrow echoing AI sidebar (`// READY WHEN YOU ARE`), H2 `Bring your next architecture review to life.`, single primary CTA → `/sign-up`.
- `landing-footer.tsx` — `border-t border-surface-border`, 3 columns (Product: Features/How/Pricing; Resources: Sign in/Sign up/Editor; Legal: Privacy/Terms placeholders `#`), bottom row `© 2026 Ghost AI` + `Built for systems thinkers` + mono `DARK ONLY`.

### 3. Design tokens (frontend-design lens, mandatory)

- Dark only. Use project tokens via Tailwind mapping ONLY: `bg-base`, `bg-surface`, `bg-elevated`, `bg-subtle`, `border-surface-border`, `text-copy-primary/secondary/muted`, `text-brand`, `bg-accent-dim`, `text-ai-text`, `bg-ai`. No hardcoded hex, no `zinc-*`, no new `--*` vars.
- Type: Geist Sans body, Geist Mono for eyebrows/metadata/badges only. Display H1 `text-4xl md:text-6xl font-semibold tracking-tight`; section H2 `text-2xl md:text-3xl font-medium`; eyebrow `font-mono text-xs uppercase tracking-widest`.
- Radius: cards `rounded-2xl`, CTA band/modal `rounded-3xl`, pills/chips `rounded-xl`/`full` for badges only.
- Icons: Lucide stroke only, `h-4 w-4` inline / `h-5 w-5` buttons / `h-8 w-8` feature tiles.
- One risk, one place: the hero schematic. Everything else disciplined spacing (`py-20 md:py-28`, `max-w-6xl mx-auto px-6` container).
- Motion: sweep + fade-up reveal only, `prefers-reduced-motion` off-switch. No scroll-jacking, no carousel (testimonials static grid).

### 4. Responsive + a11y + SEO

- Mobile-first: navbar collapses, hero stacks (copy first), grids 1→2→3, CTA band stacks. No horizontal overflow at 360px.
- Semantic landmarks (`header/main/section/footer`), one `h1`, section `aria-labelledby`, accordion keyboard-accessible, focus-visible rings (`ring-brand`), color contrast from tokens only.
- Images: schematic is CSS/SVG (no `next/image` needed). If any raster added later, must have `alt`.
- SEO: export `metadata` with title/description + OG basics. No blocking client JS on first paint.

## Scope Limits

- NO auth logic changes beyond `/` public + `page.tsx` conditional render.
- NO billing/checkout, NO `PricingTable`, NO entitlement checks, NO DB migration.
- NO live React Flow / Liveblocks on the landing (static schematic only).
- NO new global CSS vars, NO light mode, NO new font families, NO custom design system.
- NO edits to `components/ui/*` (use shadcn CLI to add `accordion` if missing).
- NO changes to `/editor`, canvas, AI sidebar, or API routes.

## Check When Done

- Logged-out `GET /` → 200 landing with navbar, hero+schematic, how-it-works, features, pricing, testimonials, FAQ, CTA band, footer. Logged-in `/` → redirect `/editor`. `/editor` still 307s to `/sign-in` when logged out.
- Pricing cards show Free/Pro/Pro Max copy, all CTAs → `/sign-up`, zero imports from billing/entitlement modules.
- Tokens only (grep for `#[0-9a-f]` and `zinc-` in `components/landing/` returns nothing), Lucide stroke icons only, Geist + mono roles respected.
- Mobile 360px no overflow, accordion keyboard-operable, reduced-motion disables sweep, Lighthouse-ish sanity (no blocking errors).
- `bun run typecheck`, `bun run lint`, `bun run build` pass. Update `.claude/context/progress-tracker.md`.
