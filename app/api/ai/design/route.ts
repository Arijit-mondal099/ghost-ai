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
//   5. returns `{ runId }` for the client to subscribe with.
//
// Trigger SDK failures (e.g. missing TRIGGER_SECRET_KEY) surface as 502 and
// write no TaskRun row.
// ---------------------------------------------------------------------------

import { currentUser } from "@clerk/nextjs/server";
import { tasks } from "@trigger.dev/sdk";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import { badRequest, HttpError, json, notFound, unauthorized } from "@/lib/api/responses";
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
  // Match against every address on the Clerk user, not just the primary —
  // an invite addressed to a secondary email must still resolve (same
  // pattern as the canvas + collaborators routes).
  const userEmails = (me?.emailAddresses ?? [])
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

  await prisma.taskRun.create({
    data: { runId, projectId, userId },
  });

  return json({ runId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
