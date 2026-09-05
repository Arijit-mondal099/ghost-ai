// ---------------------------------------------------------------------------
// POST /api/liveblocks-auth  — issue a Liveblocks session token
//
// The room id is the project id. The route:
//   1. requires Clerk authentication (defense in depth — proxy.ts already
//      gates /api/* via auth.protect()).
//   2. verifies project access using getAccessibleProject (owner or
//      collaborator by any verified email).
//   3. ensures the Liveblocks room exists with default write access (the
//      access list is the second layer — only callers who passed step 2
//      ever get a token, so anyone in the room is already authorized).
//   4. attaches user info (name, avatar, color) to the session.
//
// The response body is the Liveblocks SDK's pre-serialized JSON (typically
// `{ token: "..." }`); we pass it through verbatim with the SDK's status.
// `Cache-Control: no-store` matches every other user-dependent response.
// ---------------------------------------------------------------------------

import { currentUser } from "@clerk/nextjs/server";

import { badRequest, forbidden, unauthorized } from "@/lib/api/responses";
import { liveblocks, cursorColorForUserId } from "@/lib/liveblocks";
import {
  getAccessibleProject,
  getCurrentIdentity,
  type CurrentIdentity,
} from "@/lib/project-access";
import { parseLiveblocksAuthBody } from "@/lib/api/validation";

type AccessFailure = { kind: "auth" } | { kind: "badBody"; code: string; message: string };
type Ready = { kind: "ok"; roomId: string; identity: CurrentIdentity };

async function resolveAccess(body: unknown): Promise<AccessFailure | Ready> {
  const identity = await getCurrentIdentity();
  if (!identity) return { kind: "auth" };

  const parsed = parseLiveblocksAuthBody(body);
  if (!parsed.ok) return { kind: "badBody", code: parsed.code, message: parsed.message };

  return { kind: "ok", roomId: parsed.value.roomId, identity };
}

function accessResponse(failure: AccessFailure): Response {
  if (failure.kind === "auth") return unauthorized();
  return badRequest(failure.code, failure.message);
}

function liveblocksUnavailableResponse(): Response {
  return new Response(
    JSON.stringify({
      error: { code: "LIVEBLOCKS_UNAVAILABLE", message: "Failed to ensure Liveblocks room" },
    }),
    { status: 502, headers: { "Content-Type": "application/json" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  // 1. Parse JSON body — same pattern as app/api/projects/route.ts.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "Request body must be valid JSON");
  }

  // 2. Resolve auth + parsed body.
  const access = await resolveAccess(body);
  if (access.kind !== "ok") return accessResponse(access);
  const { roomId, identity } = access;

  // 3. Verify project access. `getAccessibleProject` collapses missing
  // projects and unauthorized users into a single null; the spec requires
  // 403 for unauthorized access, which covers both.
  const project = await getAccessibleProject(roomId, identity);
  if (!project) return forbidden("You do not have access to this project");

  // 4. Build the user info that will be attached to the session.
  const me = await currentUser();
  const fullName = me === null ? "" : `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim();
  const name = fullName.length > 0 ? fullName : (me?.username ?? identity.email);
  const avatar = me?.imageUrl ?? "";
  const color = cursorColorForUserId(identity.userId);

  // 5. Ensure the Liveblocks room exists. The access list is the second
  // defense layer — anyone who reaches this point has already passed
  // Clerk auth and project ownership.
  try {
    await liveblocks.getOrCreateRoom(roomId, { defaultAccesses: ["room:write"] });
  } catch (error) {
    console.error("Liveblocks getOrCreateRoom failed", error);
    return liveblocksUnavailableResponse();
  }

  // 6. Issue the session token. `identifyUser` returns a pre-serialized
  // body and the right status code; pass them through verbatim.
  const { status, body: tokenBody } = await liveblocks.identifyUser(
    { userId: identity.userId, groupIds: [] },
    { userInfo: { name, avatar, color } },
  );

  return new Response(tokenBody, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
