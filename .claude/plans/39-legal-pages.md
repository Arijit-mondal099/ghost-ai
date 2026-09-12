# Plan 39 — Privacy Policy & Terms Pages

## Design decisions (frontend-design pass)

- Brief wins on palette: dark workspace tokens only (`bg-base`, `bg-surface`,
  cream `--accent-primary`, indigo `--accent-ai`). No new hex, no new fonts
  (Geist Sans display/body, Geist Mono eyebrows/labels/TOC).
- Hero is a thesis: mono eyebrow `legal / privacy`, title as the promise
  ("Your designs stay yours"), one-sentence lede, `updated` stamp.
- Structure encodes meaning: sticky TOC rail (node-legend dots, anchor links,
  `scroll-mt` under navbar) + reading column. No `01/02` numbered markers —
  clauses are not a sequence.
- Signature (one risk): every clause opens with an "In plain English" cream
  line. The product turns plain English into specs; these pages turn legalese
  into plain English. Everything else stays quiet and static (no animation —
  deliberate restraint for legal reading + reduced motion).

## Files

1. `components/legal/legal-content.ts` — `LegalSection { id, label, plain,
paragraphs[], bullets? }` + `privacySections`, `termsSections`.
2. `components/legal/legal-layout.tsx` — server component: `LandingNavbar`,
   hero, TOC aside + article grid, clause cards with dotted schematic rail,
   cross-link card, `LandingFooter`, skip link. Exports `LegalLayout`.
3. `components/legal/index.ts` — barrel.
4. `app/privacy/page.tsx`, `app/terms/page.tsx` — metadata + `<LegalLayout>`.
5. `proxy.ts` — add `/privacy(.*)`, `/terms(.*)` to public matcher.
6. `components/landing/landing-footer.tsx` — Privacy/Terms `#` → real routes.
7. `app/sign-up/[[...sign-up]]/page.tsx` — agreement line under footer link.
8. `app/pricing/page.tsx` — terms note under `<PricingTable />`.

## Checks

`bunx next typegen`, `bun run typecheck`, `bun run lint`,
`bunx oxfmt --check` on touched files, `bun run build`.
Public GET `/privacy`, `/terms` → 200 (dev smoke).
