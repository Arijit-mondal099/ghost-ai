# Troubleshooting

## Database

**`P6000: Using an HTTP connection string is not supported`**
Cause: `DATABASE_URL` uses `prisma+postgres://` (Accelerate/proxy form) with the direct-TCP Prisma 7 client.
Fix: switch to `postgresql://...` via `@prisma/adapter-pg` (current `lib/prisma.ts`). Do not re-add the Accelerate branch.

**`P2021: table does not exist` / `/editor` 500s**
Cause: migrations not applied to the target DB (e.g. applied to local `prisma dev` but not Neon).
Fix: `bunx prisma migrate status` then `bunx prisma migrate deploy` against that `DATABASE_URL`.

**`TS2349: This expression is not callable` on `prisma.x.y`**
Cause: union of base + Accelerate-extended client types. Fix: single `PrismaClient` type at the singleton boundary (already done in `lib/prisma.ts`).

## Auth (401 / 403)

- `/editor` → 307 to `/sign-in`: expected when signed out (`proxy.ts` working).
- API `401 UNAUTHENTICATED`: missing/expired Clerk session — sign in again.
- API `403` on mutate: only owner (or collaborator where allowed) may write. Check `Project.ownerId` vs session `userId`, and collaborator email match (lowercased, any verified email).
- Canvas `403` from `/api/liveblocks-auth`: room id isn't an accessible project — verify `roomId == Project.id` and membership.

## Realtime

- `502 LIVEBLOCKS_UNAVAILABLE`: `getOrCreateRoom` failed — check `LIVEBLOCKS_SECRET_KEY`, service status.
- Canvas won't connect: check `/api/liveblocks-auth` response, `LIVEBLOCKS_SECRET_KEY`, and that `RoomProvider roomId` equals the project id.
- Late joiner misses AI status: readers hydrate from `aiStatus` storage (sentinel `runId: "init"` is ignored) — if empty, the run predates the dual-transport fix.

## AI / Trigger

- Run never starts: is `bun run trigger:dev` running locally? In prod, is the worker deployed (`trigger deploy`)?
- Run stuck in `PENDING_VERSION` (design sidebar shows `Design run ended (PENDING_VERSION)`, spec shows the spec variant): Trigger Cloud has the run but no deployed worker provides that task version. Check the dashboard Runs page, then: (1) deploy the worker (`trigger deploy`, same `TRIGGER_PROJECT_REF` as the app), (2) set task env (`LIVEBLOCKS_SECRET_KEY`, `GROQ_API_KEY`, `TRIGGER_SECRET_KEY`) on the Trigger Cloud project — not just Vercel, (3) keep SDK/CLI pinned to `4.5.16`. Locally this state never appears because `trigger:dev` provides the worker.
- Groq 429: fail-fast by design (no retry storm) — run surfaces `error` stage; retry manually. Check `GROQ_API_KEY` and quota.
- Empty/invalid ops: validator rejects bad shapes/colors/coords (±4000 clamp) — see `warnings` in the run result.
- `429` from API: Upstash `ai` budget hit — wait or raise limits; `rate-limit-overlay.tsx` shows the banner.

## Build

- `TS2304: Cannot find name 'RouteContext'`: `.next/types/` not generated. Fix: `bunx next typegen` (or `bun run build`) before `bun run typecheck`.
- `bun run fmt:check` flags `.claude/` specs or generated `components/ui/*`: leave untouched (surgical-changes + protected-foundation rules); format only app files.
