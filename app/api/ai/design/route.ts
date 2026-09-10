// ---------------------------------------------------------------------------
// POST /api/ai/design — trigger the design-agent background task
//
// Body: `{ prompt, projectId, roomId? }` (`roomId` defaults to `projectId`;
// `roomId === Project.id` per spec 08). The route:
//   1. requires Clerk authentication (defense in depth — proxy.ts already
//      gates /api/* via auth.protect()).
//   2. verifies project access (owner or collaborator by any verified email;
//      missing + unauthorized collapse to 404, matching the canvas route).
//   3. triggers the `design-agent` task by id with a type-only import so task
//      code is never bundled into the app.
//   4. persists a TaskRun row linking the Trigger.dev run to the requester.
//      If persistence fails after a successful trigger, the orphan run is
//      cancelled (best-effort) and dispatch fails — without a row the client
//      could never authorize the run and a retry would duplicate it.
//   5. returns `{ runId }` for the client to subscribe with.
//
// Trigger SDK failures (e.g. missing TRIGGER_SECRET_KEY) surface as 502 and
// write no TaskRun row.
// ---------------------------------------------------------------------------

import { currentUser } from "@clerk/nextjs/server";
import { runs, tasks } from "@trigger.dev/sdk";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import {
  badRequest,
  HttpError,
  json,
  notFound,
  rateLimited,
  unauthorized,
} from "@/lib/api/responses";
import { checkRateLimit, resolveRateLimitIdentifier } from "@/lib/ratelimit";
import { parseDesignTriggerBody } from "@/lib/api/validation";
import type { designAgent } from "@/trigger/design-agent";

function triggerUnavailable(): Response {
  return json(
    { error: { code: "TRIGGER_UNAVAILABLE", message: "Design task could not be started" } },
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

  // Rate-limit before any validation or billable work: 401s never consume
  // quota, and abuse never reaches Prisma/Trigger. Fail-open — Redis-down
  // allows the request.
  const designLimit = await checkRateLimit("ai", resolveRateLimitIdentifier(userId, request));
  if (!designLimit.ok) {
    return rateLimited(designLimit.limit, designLimit.remaining, designLimit.reset);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = parseDesignTriggerBody(body);
  if (!parsed.ok) {
    return badRequest(parsed.code, parsed.message);
  }
  const { prompt, projectId, roomId } = parsed.value;

  const me = await currentUser();
  // Match against every verified address on the Clerk user, not just the
  // primary — an invite addressed to a secondary email must still resolve
  // (same pattern as the canvas + collaborators routes). Unverified
  // addresses never authorize: otherwise anyone could claim an invited
  // address without proving ownership of it.
  const userEmails = (me?.emailAddresses ?? [])
    .filter((ea) => ea.verification?.status === "verified")
    .map((ea) => ea.emailAddress.toLowerCase())
    .filter((address) => address.length > 0);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
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

  // IDOR guard: `roomId` is caller-controlled but authorization above binds
  // only `projectId` (`roomId === Project.id` per spec 08). Reject a mismatched
  // room before triggering — otherwise a caller authorized for one project
  // could read and mutate another room through the design task. Collapses to
  // 404 like every other access failure on this route.
  if (roomId !== projectId) return notFound("Project not found");

  let runId: string;
  try {
    const handle = await tasks.trigger<typeof designAgent>("design-agent", {
      prompt,
      roomId,
      projectId,
    });
    runId = handle.id;
  } catch (error) {
    console.error("Trigger design-agent failed", error);
    return triggerUnavailable();
  }

  try {
    await prisma.taskRun.create({
      data: { runId, projectId, userId },
    });
  } catch (error) {
    // The task is already dispatched and could mutate the canvas, but
    // without a TaskRun row the client can never authorize it (token route
    // 404s) and a retry would start a duplicate. Compensate by cancelling
    // the orphan run (best-effort — it may already be executing) and fail
    // the dispatch so the client retries cleanly instead of tracking a
    // run it can never observe.
    console.error("TaskRun persistence failed, cancelling orphan run", error);
    try {
      await runs.cancel(runId);
    } catch (cancelError) {
      console.error("Orphan run cancellation failed", cancelError);
    }
    return triggerUnavailable();
  }

  return json({ runId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
