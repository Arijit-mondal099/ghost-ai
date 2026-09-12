# Spec 39 — Privacy Policy & Terms Pages

## Subject (pinned)

Ghost AI is a realtime collaborative system-design workspace for engineers.
Audience: developers evaluating whether to trust the product with their work.
Single job of these pages: answer "what happens to my data and my designs
if I use this?" quickly, then support full-clause reading.

## Scope

- Public routes `/privacy` and `/terms` (no auth; added to `proxy.ts` public list).
- Shared `components/legal/` shell: navbar, thesis hero, sticky clause TOC,
  clause cards, cross-link, footer. Static, no client JS.
- Real copy grounded in the actual stack: Clerk (identity + billing),
  Liveblocks (realtime rooms/presence), Trigger.dev (AI jobs), Neon Postgres
  (metadata), Vercel Blob (canvas snapshots + specs), AI model provider.
- Wire-up everywhere consent surfaces: landing footer (`#` → real routes),
  sign-up agreement line, pricing checkout note.

## Non-goals

- No cookie banner, no consent manager, no versioned legal history.
- No light mode, no new palette, no new fonts, no motion on these pages.
- No changes to Clerk/Trigger/Liveblocks runtime behavior.
