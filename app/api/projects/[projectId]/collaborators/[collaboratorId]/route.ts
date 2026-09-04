// ---------------------------------------------------------------------------
// DELETE /api/projects/[projectId]/collaborators/[collaboratorId] — remove a collaborator (owner only)
//
// Two-step pattern: confirm the project is owned by the requester, then
// delete the row scoped by both `id` and `projectId` so a stray collaborator
// id from a different project can't be removed. `deleteMany` returns a
// count so we can distinguish 404 (no such row) from 204 (success) even if
// the row was already gone.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import {
  badRequest,
  forbidden,
  HttpError,
  noContent,
  notFound,
  unauthorized,
} from "@/lib/api/responses";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/collaborators/[collaboratorId]">,
): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof HttpError) return unauthorized();
    throw error;
  }

  const { projectId, collaboratorId } = await ctx.params;
  if (projectId.trim().length === 0 || collaboratorId.trim().length === 0) {
    return badRequest("INVALID_ID", "projectId and collaboratorId are required");
  }
  const trimmedProject = projectId.trim();
  const trimmedCollab = collaboratorId.trim();

  const project = await prisma.project.findUnique({
    where: { id: trimmedProject },
    select: { ownerId: true },
  });
  if (!project) return notFound("Project not found");
  if (project.ownerId !== userId) {
    return forbidden("You do not own this project");
  }

  const result = await prisma.projectCollaborator.deleteMany({
    where: { id: trimmedCollab, projectId: trimmedProject },
  });
  if (result.count === 0) return notFound("Collaborator not found");

  return noContent();
}
