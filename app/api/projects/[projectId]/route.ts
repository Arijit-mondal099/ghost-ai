// ---------------------------------------------------------------------------
// PATCH  /api/projects/[projectId]  — rename a project
// DELETE /api/projects/[projectId]  — delete a project
//
// Both handlers use a two-step find-then-mutate pattern so that a missing
// project returns 404 and a project owned by someone else returns 403 —
// the spec requires both be distinguishable.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import {
  badRequest,
  forbidden,
  HttpError,
  json,
  noContent,
  notFound,
  unauthorized,
} from "@/lib/api/responses";
import { parseRenameProjectBody } from "@/lib/api/validation";

const PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  canvasJsonPath: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AuthFailure = { kind: "auth" };
type NotFoundFailure = { kind: "notFound" };
type ForbiddenFailure = { kind: "forbidden" };
type BadIdFailure = { kind: "badId" };
type Ready = { kind: "ok"; userId: string; projectId: string };

async function resolveContext(
  ctx: RouteContext<"/api/projects/[projectId]">,
): Promise<AuthFailure | NotFoundFailure | ForbiddenFailure | BadIdFailure | Ready> {
  let userId: string | null = null;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof HttpError) return { kind: "auth" };
    throw error;
  }

  const { projectId } = await ctx.params;
  if (projectId.trim().length === 0) {
    return { kind: "badId" };
  }

  return { kind: "ok", userId, projectId: projectId.trim() };
}

async function checkOwnership(
  userId: string,
  projectId: string,
): Promise<NotFoundFailure | ForbiddenFailure | Ready> {
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!existing) return { kind: "notFound" };
  if (existing.ownerId !== userId) return { kind: "forbidden" };
  return { kind: "ok", userId, projectId };
}

function ownershipResponse(failure: NotFoundFailure | ForbiddenFailure): Response {
  if (failure.kind === "notFound") return notFound("Project not found");
  return forbidden("You do not own this project");
}

function contextResponse(
  failure: AuthFailure | NotFoundFailure | ForbiddenFailure | BadIdFailure,
): Response {
  if (failure.kind === "auth") return unauthorized();
  if (failure.kind === "notFound") return notFound("Project not found");
  if (failure.kind === "forbidden") return forbidden("You do not own this project");
  return badRequest("INVALID_ID", "projectId is required");
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]">,
): Promise<Response> {
  const resolved = await resolveContext(ctx);
  if (resolved.kind !== "ok") return contextResponse(resolved);
  const { userId, projectId } = resolved;

  const ownership = await checkOwnership(userId, projectId);
  if (ownership.kind !== "ok") return ownershipResponse(ownership);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = parseRenameProjectBody(body);
  if (!parsed.ok) {
    return badRequest(parsed.code, parsed.message);
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { name: parsed.value.name },
    select: PROJECT_SELECT,
  });

  return json(updated);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]">,
): Promise<Response> {
  const resolved = await resolveContext(ctx);
  if (resolved.kind !== "ok") return contextResponse(resolved);
  const { userId, projectId } = resolved;

  const ownership = await checkOwnership(userId, projectId);
  if (ownership.kind !== "ok") return ownershipResponse(ownership);

  await prisma.project.delete({ where: { id: projectId } });

  return noContent();
}
