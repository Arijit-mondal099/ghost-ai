# Plan: Liveblocks Setup (Spec 10)

## Context

Spec 10 (`.claude/context/specs/10-liveblocks-setup.md`) wires the realtime collaboration layer. The Prisma schema is unchanged — `Project.id` is the Liveblocks room ID, so access is gated by the existing `getAccessibleProject` helper from spec 08 and no schema migration is needed. This spec delivers three pieces:

1. A typed `liveblocks.config.ts` declaring `Presence` (cursor + `isThinking`) and `UserMeta` (id, name, avatar, color).
2. A cached server-side `@liveblocks/node` client plus a deterministic cursor-color helper.
3. A `POST /api/liveblocks-auth` route that issues a Liveblocks session token only after a Clerk auth check + project-access check, ensuring the Liveblocks room exists, and attaching user metadata.

Intended outcome: any subsequent canvas/React Flow spec can mount a `LiveblocksProvider` and immediately connect to a room whose access list is already constrained to the project's owner and collaborators.

## Decisions

- **New dependency**: `@liveblocks/node` (server-side `Liveblocks` class with `.identifyUser` and `.getOrCreateRoom`). All other `@liveblocks/*` packages are already installed. Install via `bun add @liveblocks/node`.
- **Cursor color palette**: the 8 vivid text colors from `.claude/context/ui-context.md` — `#52A8FF`, `#BF7AF0`, `#FF990A`, `#FF6166`, `#F75F8F`, `#62C073`, `#0AC7B4`, `#EDEDED`. Harmonizes with the node text colors on the dark canvas.
- **Color hash**: djb2 — pure, deterministic, no deps, distributed enough for 8 slots.
- **Room permissions**: `defaultAccesses: ["room:write"]` so anyone who has passed our Clerk + project-access check (i.e., already has a token) can fully participate. The Liveblocks access list is the second defense layer; the first is our token issuance.
- **User info sourcing**: `currentUser()` from `@clerk/nextjs/server` (no extra Clerk round-trip — same call `getCurrentIdentity` already makes). `name` from `displayNameFromClerk(user)` → fallback to `identity.email`. `avatar` from `currentUser()?.imageUrl` or empty string.
- **Error handling**: `identifyUser` returns `{ status, body }` — propagate both verbatim. `getOrCreateRoom` throws `LiveblocksError` — wrap in `try/catch` and return a hand-constructed 502 (one-off, no new helper in `lib/api/responses.ts`).
- **Response shape**: `new Response(body, { status })` for the `identifyUser` pass-through — the SDK returns a pre-serialized JSON body (typically `{ token: "..." }`) that must reach the client unchanged. Matches the project's "no `{ data }` wrapper" convention (the body IS the data).
- **`liveblocks.config.ts` scope**: fill only `Presence` and `UserMeta`. Leave `Storage`, `RoomEvent`, `ThreadMetadata`, `RoomInfo` as `{}` — the spec doesn't ask for them; predefining other shapes invites future spec authors to assume they're correct.

## Files to create

### `lib/liveblocks.ts` (new)

Server-only module. `import "server-only"` at the top — same pattern as `lib/clerk-users.ts:22`. Mirrors the `lib/prisma.ts` globalThis-singleton pattern.

Exports:

- `liveblocks: Liveblocks` — cached `Liveblocks` client. Constructor reads `LIVEBLOCKS_SECRET_KEY` and throws at module load if missing (fail fast on cold start).
- `CURSOR_COLORS: readonly string[]` — the 8-color palette in the order listed in `ui-context.md`. Source of truth for the helper and any future client-side renderer.
- `cursorColorForUserId(userId: string): string` — djb2 hash, `Math.abs(hash) % CURSOR_COLORS.length`. Empty `userId` falls back to index 0 (defensive default — should never happen since the route guards on `requireUserId`).

Module comment block: explains the singleton rationale (one `Liveblocks` client per process — the underlying HTTP client is expensive to recreate on every request), the `server-only` guarantee, and the djb2 choice.

### `app/api/liveblocks-auth/route.ts` (new)

One handler — `POST`. Follows the exact shape of `app/api/projects/[projectId]/route.ts` (discriminated-union `resolveAccess`, `accessResponse`, no `{ data }` wrapper, `Cache-Control: no-store`).

Flow:

1. Parse JSON body — `try { body = await request.json(); } catch { return badRequest("INVALID_JSON", "Request body must be valid JSON"); }` (same pattern as `app/api/projects/route.ts:54-58`).
2. Validate with `parseLiveblocksAuthBody` from `lib/api/validation.ts` — if not `ok`, `badRequest(parsed.code, parsed.message)`.
3. Resolve access (discriminated union: `auth | badId | ok`):
   - `await getCurrentIdentity()` → if `null` return `{ kind: "auth" }` (defense in depth — `proxy.ts` already gates `/api/*`).
   - Read `roomId` from parsed body, `.trim()` it; if empty, `{ kind: "badId" }` (catch-all: `parseLiveblocksAuthBody` already rejects empty, so this is the post-trim check).
   - Return `{ kind: "ok", userId, roomId, identity }`.
4. `accessResponse(failure)`: `auth` → `unauthorized()`; `badId` → `badRequest("INVALID_BODY", "roomId is required")`.
5. After access resolves: `const project = await getAccessibleProject(roomId, identity);` — if `null`, `forbidden("You do not have access to this project")` (spec-mandated 403).
6. Build user info:
   ```ts
   const me = await currentUser();
   const name = displayNameFromClerk(me) ?? identity.email;
   const avatar = me?.imageUrl ?? "";
   const color = cursorColorForUserId(userId);
   ```
7. `getOrCreateRoom` wrapped in `try/catch`:
   ```ts
   try {
     await liveblocks.getOrCreateRoom(roomId, { defaultAccesses: ["room:write"] });
   } catch (error) {
     console.error("Liveblocks getOrCreateRoom failed", error);
     return new Response(
       JSON.stringify({
         error: { code: "LIVEBLOCKS_UNAVAILABLE", message: "Failed to ensure Liveblocks room" },
       }),
       { status: 502, headers: { "Content-Type": "application/json" } },
     );
   }
   ```
   No new helper in `lib/api/responses.ts` — one-off site. Mirrors the inline-`Response` construction for the 409 in `app/api/projects/[projectId]/collaborators/route.ts:235-242`.
8. `const { status, body } = await liveblocks.identifyUser({ userId }, { userInfo: { name, avatar, color } });` — return `new Response(body, { status, headers: { "Cache-Control": "no-store" } })`. Pass the body through verbatim.

Imports: `currentUser` from `@clerk/nextjs/server`; `getCurrentIdentity` from `@/lib/project-access`; `displayNameFromClerk` from `@/lib/clerk-users`; `badRequest, forbidden, json, unauthorized` from `@/lib/api/responses`; `parseLiveblocksAuthBody` from `@/lib/api/validation`; `liveblocks, cursorColorForUserId` from `@/lib/liveblocks`; `LiveblocksError` type from `@liveblocks/node` (only for the `instanceof` check if used — otherwise leave the catch broad).

## Files to modify

### `lib/api/validation.ts`

Add one export — `parseLiveblocksAuthBody(input: unknown): ParseResult<{ roomId: string }>`. Follows the same shape as `parseInviteCollaboratorBody` (`lib/api/validation.ts:112-134`): `isPlainObject` → `rejectUnknownFields(input, ["roomId"])` → require `roomId` as a non-empty trimmed string. Error code: `"INVALID_BODY"` (shape error) or `"INVALID_BODY"` (empty `roomId` — same code is fine; spec only requires the field).

### `liveblocks.config.ts`

Replace the commented stubs with concrete types. Leave `Storage`, `RoomEvent`, `ThreadMetadata`, `RoomInfo` as `{}`.

```ts
declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      isThinking: boolean;
    };

    Storage: {};

    UserMeta: {
      id: string;
      info: {
        name: string;
        avatar: string;
        color: string;
      };
    };

    RoomEvent: {};
    ThreadMetadata: {};
    RoomInfo: {};
  }
}

export {};
```

`cursor: { x: number; y: number } | null` — `null` when the cursor leaves the canvas (so React Flow can render a "left the canvas" indicator without a sentinel `(-1, -1)`). `UserMeta.info.color` is a plain `string` (the helper returns a plain string); a literal-type union would require the palette to live in this file and create a circular import through `lib/liveblocks.ts`.

### `package.json`

Add `"@liveblocks/node": "^3.24.1"` to `dependencies`. `bun add` will regenerate `bun.lock` — no manual edits.

## Reused patterns (do not re-derive)

- **Singleton-with-`globalThis`** — exact mirror of `lib/prisma.ts`. Indentation, comment style, `process.env["NODE_ENV"] !== "production"` gate all match.
- **`server-only` import** — same preamble as `lib/clerk-users.ts:22`.
- **Route handler shape** — `RouteContext` typed params (no `ctx` here — body is the only input) + discriminated-union `resolveAccess` + `accessResponse` helper, exactly like `app/api/projects/[projectId]/route.ts:39-83`.
- **Auth defense in depth** — the proxy in `proxy.ts` already gates `/api/*` via `auth.protect()`, so the in-route `getCurrentIdentity` → `null` check is belt-and-suspenders (matches the comment in `lib/api/auth.ts:5-7`).
- **Hand-rolled validation** — `parseLiveblocksAuthBody` follows the `isPlainObject` → `rejectUnknownFields` → typed-read pattern as `parseInviteCollaboratorBody` in `lib/api/validation.ts:112-134`.
- **Bare success bodies** — `new Response(body, { status })` for the `identifyUser` pass-through, because the SDK returns a pre-serialized body. The "no `{ data }` wrapper" rule is preserved.
- **`Cache-Control: no-store`** — same header as `app/api/projects/route.ts:45`. Required for any user-dependent response.
- **Inline `Response` for ad-hoc status codes** — the 502 path mirrors the 409 construction in `app/api/projects/[projectId]/collaborators/route.ts:235-242`. Avoids polluting `responses.ts` with a one-off.
- **User info helpers** — `displayNameFromClerk` from `lib/clerk-users.ts:40` already does firstName + lastName → username → null; combined with the email fallback from `identity.email`, no new Clerk helper is needed.

## Verification

Run from the project root in this order:

1. `bun add @liveblocks/node` — adds the dependency and regenerates `bun.lock`.
2. `bunx next typegen` — no new dynamic routes, but a safety net (matches spec 06's verification chain).
3. `bun run typecheck` (tsc --noEmit) exits 0. Watchpoints:
   - `liveblocks.config.ts` uses `declare global { interface Liveblocks { ... } }` — the global augmentation requires `export {};` at the bottom (already there).
   - `parseLiveblocksAuthBody` `ParseResult` shape matches the `parseInviteCollaboratorBody` discriminator.
   - No `any` — `Liveblocks.userInfo` is loose-typed, but the route uses an object literal whose shape is enforced by the `Liveblocks` class signature.
4. `bun run lint` (oxlint) exits 0. No unused imports — `currentUser` is the only Clerk import needed in the route; `Liveblocks` is imported as a type-and-value from `@liveblocks/node`.
5. `bun run fmt:check` (oxfmt) clean on the three new/touched files.
6. `bun run build` exits 0. The build manifest should show `ƒ /api/liveblocks-auth` as a dynamic route.
7. Manual smoke matrix (real Clerk session + Liveblocks dev key required; `/api/*` is proxy-protected):
   - **Authenticated owner POSTs `{ roomId: <own-project-id> }`** — returns `200` with a JSON body containing a `token` field. The Liveblocks room is created on first call (visible in the Liveblocks dashboard under the project ID).
   - **Authenticated collaborator POSTs `{ roomId: <accessible-project-id> }`** — `200` with token, room access list shows both owner + collaborator.
   - **Authenticated non-member POSTs `{ roomId: <inaccessible-project-id> }`** — `403 FORBIDDEN` with message "You do not have access to this project".
   - **Unauthenticated POST** — proxy redirects to sign-in (the in-route `getCurrentIdentity` null check is the defense-in-depth path; verifying it requires a direct `curl` that bypasses the proxy).
   - **POST with missing/empty `roomId`** — `400 INVALID_BODY`.
   - **POST with extra fields** — `400 INVALID_BODY` (unknown field: X).
   - **Second POST for the same room** — `200`, no duplicate room created, same token shape returned.
   - **Color stability** — same Clerk user ID across multiple POSTs gets the same color every time (verify by inspecting the returned `token`'s `userInfo`).
   - **No-env-var failure** — temporarily unsetting `LIVEBLOCKS_SECRET_KEY` and starting the dev server should fail fast on the first request to `/api/liveblocks-auth` with a thrown error (the `liveblocks` constructor throws at module load).

## Critical files

- `D:\code\build-with-claude-code\ghost-ai\lib\liveblocks.ts` (new — cached `Liveblocks` client + `cursorColorForUserId` + `CURSOR_COLORS` palette)
- `D:\code\build-with-claude-code\ghost-ai\app\api\liveblocks-auth\route.ts` (new — POST handler, the only consumer of the cached client)
- `D:\code\build-with-claude-code\ghost-ai\lib\api\validation.ts` (modify — add `parseLiveblocksAuthBody`)
- `D:\code\build-with-claude-code\ghost-ai\liveblocks.config.ts` (modify — fill in `Presence` + `UserMeta`)
- `D:\code\build-with-claude-code\ghost-ai\package.json` (modify — add `@liveblocks/node` dependency)
