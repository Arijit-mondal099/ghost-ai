// ---------------------------------------------------------------------------
// GET  /api/projects/[projectId]/collaborators  — list collaborators (owner + collaborator)
// POST /api/projects/[projectId]/collaborators  — invite a collaborator (owner only)
//
// GET is accessible to anyone with project access (owner or existing
// collaborator — see getAccessibleProject in lib/project-access.ts). POST is
// restricted to the owner and is the only mutation in this file.
//
// The GET response also returns the owner's Clerk-enriched profile (so the
// dialog can render the "Owner" row without a separate request). The Clerk
// lookup is best-effort: a failure logs and returns an owner stub with
// `name: null` + `imageUrl: null` so the dialog still renders uniformly.
// ---------------------------------------------------------------------------

import { currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import {
  badRequest,
  forbidden,
  HttpError,
  json,
  notFound,
  unauthorized,
} from "@/lib/api/responses";
import { parseInviteCollaboratorBody } from "@/lib/api/validation";
import { enrichCollaborators, findUserByEmail, findUserById } from "@/lib/clerk-users";

type AccessFailure =
  | { kind: "auth" }
  | { kind: "notFound" }
  | { kind: "forbidden" }
  | { kind: "badId" };
type AccessOk = { kind: "ok"; userId: string; projectId: string };

async function resolveReadAccess(
  ctx: RouteContext<"/api/projects/[projectId]/collaborators">,
): Promise<AccessFailure | AccessOk> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof HttpError) return { kind: "auth" };
    throw error;
  }

  const { projectId } = await ctx.params;
  if (projectId.trim().length === 0) return { kind: "badId" };
  const trimmedId = projectId.trim();

  const me = await currentUser();
  // Match against every verified address on the Clerk user, not just the
  // primary — an invite addressed to a secondary email must still resolve.
  const userEmails = (me?.emailAddresses ?? [])
    .map((ea) => ea.emailAddress.toLowerCase())
    .filter((address) => address.length > 0);

  const project = await prisma.project.findFirst({
    where: {
      id: trimmedId,
      OR: [
        { ownerId: userId },
        ...(userEmails.length > 0
          ? [{ collaborators: { some: { email: { in: userEmails } } } }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (!project) return { kind: "notFound" };
  return { kind: "ok", userId, projectId: trimmedId };
}

async function resolveWriteAccess(
  ctx: RouteContext<"/api/projects/[projectId]/collaborators">,
): Promise<AccessFailure | AccessOk> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof HttpError) return { kind: "auth" };
    throw error;
  }

  const { projectId } = await ctx.params;
  if (projectId.trim().length === 0) return { kind: "badId" };
  const trimmedId = projectId.trim();

  const project = await prisma.project.findUnique({
    where: { id: trimmedId },
    select: { ownerId: true },
  });
  if (!project) return { kind: "notFound" };
  if (project.ownerId !== userId) return { kind: "forbidden" };
  return { kind: "ok", userId, projectId: trimmedId };
}

function accessResponse(failure: AccessFailure): Response {
  if (failure.kind === "auth") return unauthorized();
  if (failure.kind === "notFound") return notFound("Project not found");
  if (failure.kind === "forbidden") return forbidden("You do not own this project");
  return badRequest("INVALID_ID", "projectId is required");
}

async function resolveOwnerProfile(
  ownerId: string,
  requesterId: string,
): Promise<{ userId: string; email: string; name: string | null; imageUrl: string | null }> {
  // If the requester is the owner, read from their own currentUser (cheapest
  // path — no extra Clerk round-trip). Otherwise look up the owner by id.
  if (ownerId === requesterId) {
    const me = await currentUser();
    const email = me?.emailAddresses[0]?.emailAddress.toLowerCase() ?? "";
    return {
      userId: ownerId,
      email,
      name: me ? deriveName(me) : null,
      imageUrl: me?.imageUrl ? me.imageUrl : null,
    };
  }
  const owner = await findUserById(ownerId);
  return {
    userId: ownerId,
    email: owner?.email ?? "",
    name: owner?.name ?? null,
    imageUrl: owner?.imageUrl ?? null,
  };
}

function deriveName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string | null {
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  if (full.length > 0) return full;
  return user.username ?? null;
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/collaborators">,
): Promise<Response> {
  const access = await resolveReadAccess(ctx);
  if (access.kind !== "ok") return accessResponse(access);

  const project = await prisma.project.findUnique({
    where: { id: access.projectId },
    select: { ownerId: true },
  });
  if (!project) return notFound("Project not found");

  const rows = await prisma.projectCollaborator.findMany({
    where: { projectId: access.projectId },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });

  const [enrichedCollaborators, owner] = await Promise.all([
    enrichCollaborators(rows.map((r) => r.email)),
    resolveOwnerProfile(project.ownerId, access.userId),
  ]);

  const byEmail = new Map(enrichedCollaborators.map((c) => [c.email, c]));
  const collaborators = rows.map((row) => {
    const hit = byEmail.get(row.email.toLowerCase());
    return {
      id: row.id,
      email: row.email,
      name: hit?.name ?? null,
      imageUrl: hit?.imageUrl ?? null,
    };
  });

  return json({ owner, collaborators }, { headers: { "Cache-Control": "no-store" } });
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/collaborators">,
): Promise<Response> {
  const access = await resolveWriteAccess(ctx);
  if (access.kind !== "ok") return accessResponse(access);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = parseInviteCollaboratorBody(body);
  if (!parsed.ok) {
    return badRequest(parsed.code, parsed.message);
  }

  // Pre-check: verify a Clerk account exists for that email. The spec
  // requires an inline error when no account exists. `findUserByEmail`
  // returns `null` (not a stub) on no-match so the `=== null` check below
  // is the gate — do not weaken it to a truthiness check, or the helper
  // contract breaks and unknown emails silently get invited.
  const clerkUser = await findUserByEmail(parsed.value.email);
  if (clerkUser === null) {
    return badRequest("USER_NOT_FOUND", "No Clerk account exists for that email");
  }

  try {
    const created = await prisma.projectCollaborator.create({
      data: { projectId: access.projectId, email: parsed.value.email },
      select: { id: true, email: true, createdAt: true },
    });
    return json(
      {
        id: created.id,
        email: created.email,
        name: clerkUser.name,
        imageUrl: clerkUser.imageUrl,
      },
      {
        status: 201,
        headers: { Location: `/api/projects/${access.projectId}/collaborators/${created.id}` },
      },
    );
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return new Response(
        JSON.stringify({
          error: { code: "ALREADY_COLLABORATOR", message: "That email is already a collaborator" },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }
    throw error;
  }
}
