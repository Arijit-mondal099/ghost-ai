# FAQ

## What is Ghost AI?

A realtime collaborative system-design workspace: prompt an AI architect, refine the graph with collaborators on a shared canvas, export a Markdown technical spec.

## Who is it for?

Engineers, architects, and teams who whiteboard systems and need a persistent, shareable spec — not a throwaway diagram.

## Is it open source?

Yes. Fork, self-host, and contribute (see [Contributing](./contributing.md)). Add a `LICENSE` (MIT/Apache-2.0 recommended) before redistributing.

## What does it cost to run?

Next.js + Postgres (Neon free tier works for dev), plus usage-based: Clerk (MAUs), Liveblocks (MAUs/rooms), Trigger.dev (runs), Groq (tokens), Vercel Blob (storage), Upstash (requests). No billing code in-repo (out of scope) — plan caps (`free: 3`, `pro: 100`, `pro_max: 1000`) read Clerk plans.

## Can I use my own LLM?

Yes — swap the Groq call in `trigger/design-agent.ts` + `trigger/generate-spec.ts`. Keep the `{ ops: [] }` contract (design) and Markdown output (spec), plus caps/validation, so the canvas stays consistent.

## Where is my data stored?

Metadata in Postgres; canvas snapshots + specs in private Vercel Blob; live graph in Liveblocks rooms. Blob URLs are never exposed — all reads go through gated API routes.

## What's out of scope?

Billing/subscriptions, enterprise permission tiers (owner/collaborator only), versioned spec history/review workflows, production object-storage migration beyond Blob, mobile-native apps.

## Roadmap ideas

Spec versioning + diff, review/approval flows, more starter templates, additional LLM providers, self-hosted storage backends, offline canvas editing.
