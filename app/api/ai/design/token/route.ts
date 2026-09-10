// ---------------------------------------------------------------------------
// POST /api/ai/design/token — mint a run-scoped Trigger.dev public token
//
// Body: `{ runId }`. The route:
//   1. requires Clerk authentication.
//   2. looks up the TaskRun row; missing → 404.
//   3. verifies the requester triggered the run (`userId` match → else 403).
//   4. re-checks current project access (owner or collaborator) so removed
//      collaborators lose access; miss → 404.
//   5. mints `auth.createPublicToken({ scopes: { read: { runs: [runId] } } })`
//      — a scopeless token authorizes nothing, so the scope is mandatory.
//   6. returns `{ token }` for `useRealtimeRun` / `useRealtimeStream`.
//
// `Cache-Control: no-store` matches every other user-dependent response.
// ---------------------------------------------------------------------------

import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@trigger.dev/sdk";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import {
  badRequest,
  forbidden,
  HttpError,
  json,
  notFound,
  rateLimited,
  unauthorized,
} from "@/lib/api/responses";
import { checkRateLimit, resolveRateLimitIdentifier } from "@/lib/ratelimit";
import { parseDesignTokenBody } from "@/lib/api/validation";

function tokenUnavailable(): Response {
  return json(
    { error: { code: "TOKEN_UNAVAILABLE", message: "Run token could not be issued" } },
    { status: 502 },
  );
}

export async function POST(request: Request): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof HttpError) return unauthorized();
    throw error;
  }

  // Token fetches share the `ai` budget with the generations they authorize:
  // 401s never consume quota, and abuse never reaches Prisma/Trigger.
  // Fail-open — Redis-down allows the request.
  const designTokenLimit = await checkRateLimit("ai", resolveRateLimitIdentifier(userId, request));
  if (!designTokenLimit.ok) {
    return rateLimited(designTokenLimit.limit, designTokenLimit.remaining, designTokenLimit.reset);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = parseDesignTokenBody(body);
  if (!parsed.ok) {
    return badRequest(parsed.code, parsed.message);
  }
  const { runId } = parsed.value;

  const taskRun = await prisma.taskRun.findUnique({
    where: { runId },
    select: { projectId: true, userId: true },
  });
  if (!taskRun) return notFound("Run not found");
  if (taskRun.userId !== userId) {
    return forbidden("You do not own this run");
  }

  const me = await currentUser();
  // Verified addresses only (see trigger route): an unverified secondary
  // address matching an invite must not mint run tokens.
  const userEmails = (me?.emailAddresses ?? [])
    .filter((ea) => ea.verification?.status === "verified")
    .map((ea) => ea.emailAddress.toLowerCase())
    .filter((address) => address.length > 0);

  const project = await prisma.project.findFirst({
    where: {
      id: taskRun.projectId,
      OR: [
        { ownerId: userId },
        ...(userEmails.length > 0
          ? [{ collaborators: { some: { email: { in: userEmails } } } }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (!project) return notFound("Project not found");

  try {
    const token = await auth.createPublicToken({
      scopes: { read: { runs: [runId] } },
    });
    return json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("createPublicToken failed", error);
    return tokenUnavailable();
  }
}
