# Configuration

All keys live in `.env` / `.env.local` (Next.js loads `.env.local` last, so it wins). Never commit secrets.

| Variable                            | Required | Exposed to browser | Where to get it                                                                |
| ----------------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------ |
| `DATABASE_URL`                      | yes      | no                 | Neon dashboard → connection string (`sslmode=require&channel_binding=require`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes      | yes                | Clerk dashboard → API keys                                                     |
| `CLERK_SECRET_KEY`                  | yes      | no                 | Clerk dashboard → API keys                                                     |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | yes      | yes                | Set to `/sign-in` (drives `proxy.ts` public routes)                            |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`     | yes      | yes                | Set to `/sign-up`                                                              |
| `LIVEBLOCKS_SECRET_KEY`             | yes      | no                 | Liveblocks dashboard → API keys (`lib/liveblocks.ts` server client)            |
| `TRIGGER_PROJECT_REF`               | yes      | no                 | Trigger.dev dashboard → project ref (`trigger.config.ts`)                      |
| `TRIGGER_SECRET_KEY`                | yes      | no                 | Trigger.dev dashboard → dev/prod keys                                          |
| `GROQ_API_KEY`                      | yes      | no                 | Groq console → API keys (used inside `trigger/*` only)                         |
| `BLOB_READ_WRITE_TOKEN`             | yes      | no                 | Vercel dashboard → Blob store (private store for canvas + specs)               |
| `UPSTASH_REDIS_REST_URL`            | yes      | no                 | Upstash console → Redis REST URL                                               |
| `UPSTASH_REDIS_REST_TOKEN`          | yes      | no                 | Upstash console → Redis REST token                                             |
| `GROQ_SPEC_MAX_TOKENS`              | no       | no                 | Optional override, `256–32000`, default `1000`                                 |

## Service notes

- **Clerk**: public routes are `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/privacy(.*)`, `/terms(.*)` (see `proxy.ts`). Everything else calls `auth.protect()`.
- **Liveblocks**: server creates rooms on demand (`getOrCreateRoom(roomId, { defaultAccesses: ["room:write"] })`). Auth endpoint identifies users with `{ name, avatar, color }`.
- **Trigger.dev**: `trigger.config.ts` → `project: process.env.TRIGGER_PROJECT_REF`, `dirs: ["trigger"]`, `maxDuration: 3600`, 3× exponential retries (`factor 2`, `1s–10s`, `enabledInDev: false`). Run `bun run trigger:dev` locally.
- **Vercel Blob**: private store. Canvas at `canvas/{projectId}.json`, specs at `specs/{projectId}/{specId}.md`. API uses `put()`/`get()` server-side; clients never fetch Blob URLs directly.
- **Upstash**: `ai` ratelimit budget gates all `/api/ai/*` + project writes; cache keys `projects`, `collabs`, `specs`, `access` with version bump on deletes.
- **Prisma 7**: `prisma.config.ts` points at `DATABASE_URL`; client output `app/generated/prisma/` (gitignored). Direct-TCP via `@prisma/adapter-pg` — do **not** use `prisma+postgres://` HTTP strings with this client version (causes `P6000`).
