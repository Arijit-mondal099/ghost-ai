# Deployment

## Services

| Service     | Used for                        | Production setup                                                                   |
| ----------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| Vercel      | Next.js hosting                 | Connect repo, set env vars, `bun run build`                                        |
| Neon        | PostgreSQL                      | Create DB, set `DATABASE_URL`, run `prisma migrate deploy`                         |
| Trigger.dev | `design-agent`, `generate-spec` | Create project, set `TRIGGER_PROJECT_REF` + `TRIGGER_SECRET_KEY`, `trigger deploy` |
| Clerk       | Auth                            | Production instance, set publishable + secret keys, configure sign-in/up URLs      |
| Liveblocks  | Realtime rooms                  | Production secret key                                                              |
| Vercel Blob | Private artifact store          | Create store, set `BLOB_READ_WRITE_TOKEN`                                          |
| Upstash     | Redis (ratelimit + cache)       | REST URL + token                                                                   |
| Groq        | LLM                             | API key                                                                            |

## Checklist

1. Set all [Configuration](./configuration.md) vars in the hosting provider (no `.env.local` in prod).
2. `bunx prisma migrate deploy` against the production `DATABASE_URL` (fixes `P2021`).
3. `trigger deploy` (or dashboard deploy) so `design-agent` / `generate-spec` workers exist in prod.
4. Verify Clerk production URLs: `/sign-in`, `/sign-up`, redirect rules, public routes (`/`, `/privacy`, `/terms`) still public.
5. `bun run build` → expect all routes + `Proxy (Middleware)` with exit 0. Smoke test: `/` → 200, `/sign-in` → 200, `/editor` signed-out → 307 to sign-in, signed-in → project list, canvas connects, AI run completes, spec downloads.

## Notes

- `trigger.config.ts` retries: 3× exponential, `enabledInDev: false` — dev failures surface immediately; prod retries.
- Blob store must be **private**; the app gates all reads through API routes.
- `GROQ_SPEC_MAX_TOKENS` tunes spec length without a redeploy of task code (env-only).
- Never use `prisma+postgres://` URLs with this Prisma 7 client — direct TCP only.
