// ---------------------------------------------------------------------------
// POST /api/ai/spec — trigger the generate-spec background task
//
// Body: `{ roomId, chatHistory, nodes, edges }`. No `projectId` is accepted:
// project access is resolved from `roomId` (`roomId === Project.id` per spec
// 08), so a client-supplied project id would only be an IDOR vector. The
// route:
//   1. requires Clerk authentication (defense in depth — proxy.ts already
//      gates /api/* via auth.protect()).
//   2. verifies project access from `roomId` (owner or collaborator by any
//      verified email; missing + unauthorized collapse to 404, matching the
//      canvas route).
//   3. triggers the `generate-spec` task by id with a type-only import so task
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
import { badRequest, HttpError, json, notFound, unauthorized } from "@/lib/api/responses";
import { parseSpecTriggerBody } from "@/lib/api/validation";
import type { generateSpec } from "@/trigger/generate-spec";

function triggerUnavailable(): Response {
  return json(
    { error: { code: "TRIGGER_UNAVAILABLE", message: "Spec task could not be started" } },
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

  const parsed = parseSpecTriggerBody(body);
  if (!parsed.ok) {
    return badRequest(parsed.code, parsed.message);
  }
  const { roomId, chatHistory, nodes, edges } = parsed.value;
  // Project access comes from the authenticated user + `roomId` only — never
  // from a client-provided project id (the validator rejects one outright).
  const projectId = roomId;

  const me = await currentUser();
  // Match against every verified address on the Clerk user, not just the
  // primary — an invite addressed to a secondary email must still resolve
  // (same pattern as the canvas + collaborators + design routes). Unverified
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

  let runId: string;
  try {
    const handle = await tasks.trigger<typeof generateSpec>("generate-spec", {
      projectId,
      roomId,
      chatHistory,
      nodes,
      edges,
    });
    runId = handle.id;
  } catch (error) {
    console.error("Trigger generate-spec failed", error);
    return triggerUnavailable();
  }

  try {
    await prisma.taskRun.create({
      data: { runId, projectId, userId },
    });
  } catch (error) {
    // The task is already dispatched and could be generating, but without a
    // TaskRun row the client can never authorize it (token route 404s) and a
    // retry would start a duplicate. Compensate by cancelling the orphan run
    // (best-effort — it may already be executing) and fail the dispatch so
    // the client retries cleanly instead of tracking a run it can never
    // observe.
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
