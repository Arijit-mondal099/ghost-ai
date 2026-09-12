# Getting Started

## Prerequisites

- Node.js `>= 22.0.0`
- `bun@1.3.14` (repo `packageManager`; npm/pnpm also work for Next.js but scripts assume bun for Trigger CLI)
- PostgreSQL (Neon recommended)
- Accounts/keys: Clerk, Liveblocks, Trigger.dev, Vercel Blob, Upstash Redis, Groq

## 1. Clone & install

```bash
git clone <your-fork-url> ghost-ai
cd ghost-ai
bun install
```

## 2. Configure environment

Copy `.env.example` if present, otherwise create `.env.local`:

```bash
DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require&channel_binding=require"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
LIVEBLOCKS_SECRET_KEY="sk_..."
TRIGGER_PROJECT_REF="proj_..."
TRIGGER_SECRET_KEY="tr_..."
GROQ_API_KEY="gsk_..."
BLOB_READ_WRITE_TOKEN="vercel_blob_..."
UPSTASH_REDIS_REST_URL="https://....upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
# Optional
GROQ_SPEC_MAX_TOKENS="1000"
```

Only `NEXT_PUBLIC_*` keys are exposed to the browser. See [Configuration](./configuration.md) for where each key comes from.

## 3. Database

```bash
bunx prisma migrate status   # verify against DATABASE_URL
bunx prisma migrate deploy   # apply pending migrations (first deploy / fresh Neon)
bunx prisma generate         # regenerate client into app/generated/prisma (if needed)
```

Prisma 7 client output lives at `app/generated/prisma/` (gitignored). Schema is split: `prisma/schema.prisma` + `prisma/models/*.prisma`.

## 4. Run

```bash
bun run dev            # Next.js at http://localhost:3000
bun run trigger:dev    # Trigger.dev local worker (separate terminal)
```

Open `http://localhost:3000`:

- Signed out → landing page (`/` is public)
- Signed in → redirected to `/editor`

## 5. First project flow

1. Sign up at `/sign-up`, sign in at `/sign-in`.
2. `/editor` → **New Project** → enter name → created via `POST /api/projects`, navigates to `/editor/{projectId}`.
3. Canvas loads via Liveblocks auth (`POST /api/liveblocks-auth`). Drag shapes from the bottom shape panel, or import a starter template.
4. Open the AI sidebar (right) → enter a prompt → `POST /api/ai/design` triggers the `design-agent` Trigger task; nodes/edges stream into the shared room.
5. **Specs tab → Generate Spec** → `POST /api/ai/spec` triggers `generate-spec`; Markdown is persisted via `POST /api/projects/{id}/specs` and downloadable from the specs list.

## Scripts

| Script              | Command                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `dev`               | `next dev`                                                                                       |
| `build`             | `next build`                                                                                     |
| `start`             | `next start`                                                                                     |
| `trigger:dev`       | `bunx trigger.dev@4.5.16 dev`                                                                    |
| `lint` / `lint:fix` | `oxlint` / `oxlint --fix`                                                                        |
| `fmt` / `fmt:check` | `oxfmt` / `oxfmt --check`                                                                        |
| `typecheck`         | `tsc --noEmit` (run `bunx next typegen` first if dynamic-route `RouteContext` types are missing) |
| `prepare`           | `husky`                                                                                          |
