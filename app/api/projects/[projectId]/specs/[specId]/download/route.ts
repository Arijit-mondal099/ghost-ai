// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/specs/[specId]/download — download a
// persisted spec as a Markdown attachment.
//
// The Blob store is private, so the file is read by deterministic pathname
// (`specs/{projectId}/{specId}.md`) through the SDK `get()` (which
// authenticates with `BLOB_READ_WRITE_TOKEN`) — the stored `filePath` URL is
// metadata only and never fetched directly, so Blob URLs are never exposed
// without an access check.
//
// Access: owner OR collaborator on the project (same gate as the save
// route), plus the spec row must belong to the project in the path.
// Missing project, unauthorized project, unknown spec, and cross-project
// spec ids all collapse to 404 (no bare 403 — avoids ID enumeration, per the
// spec-08/canvas precedent).
// ---------------------------------------------------------------------------

import { currentUser } from "@clerk/nextjs/server";
import { get } from "@vercel/blob";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import { badRequest, HttpError, json, notFound, unauthorized } from "@/lib/api/responses";

type AccessFailure = { kind: "auth" } | { kind: "notFound" } | { kind: "badId" };
type AccessOk = { kind: "ok"; projectId: string; specId: string };

async function resolveDownloadAccess(
  ctx: RouteContext<"/api/projects/[projectId]/specs/[specId]/download">,
): Promise<AccessFailure | AccessOk> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof HttpError) return { kind: "auth" };
    throw error;
  }

  const { projectId, specId } = await ctx.params;
  if (projectId.trim().length === 0 || specId.trim().length === 0) {
    return { kind: "badId" };
  }
  const trimmedProjectId = projectId.trim();
  const trimmedSpecId = specId.trim();

  const me = await currentUser();
  // Match against every verified address on the Clerk user, not just the
  // primary — an invite addressed to a secondary email must still resolve.
  // Unverified addresses never authorize: otherwise anyone could claim an
  // invited address without proving ownership of it (same predicate as the
  // spec trigger + token routes).
  const userEmails = (me?.emailAddresses ?? [])
    .filter((ea) => ea.verification?.status === "verified")
    .map((ea) => ea.emailAddress.toLowerCase())
    .filter((address) => address.length > 0);

  const project = await prisma.project.findFirst({
    where: {
      id: trimmedProjectId,
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
  return { kind: "ok", projectId: trimmedProjectId, specId: trimmedSpecId };
}

function accessResponse(failure: AccessFailure): Response {
  if (failure.kind === "auth") return unauthorized();
  if (failure.kind === "badId")
    return badRequest("INVALID_ID", "projectId and specId are required");
  return notFound("Project not found");
}

function blobUnavailable(): Response {
  return json(
    { error: { code: "BLOB_UNAVAILABLE", message: "Spec storage is unavailable" } },
    { status: 502 },
  );
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/specs/[specId]/download">,
): Promise<Response> {
  const access = await resolveDownloadAccess(ctx);
  if (access.kind !== "ok") return accessResponse(access);

  // The spec must belong to the project in the path — a valid spec id from
  // another project is a 404 here, not a cross-project read.
  const spec = await prisma.projectSpec.findUnique({
    where: { id: access.specId },
    select: { projectId: true, filePath: true },
  });
  if (!spec || spec.projectId !== access.projectId || spec.filePath.length === 0) {
    return notFound("Spec not found");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) return blobUnavailable();

  // Private store: read by deterministic pathname through the SDK (token
  // auth). `useCache: false` bypasses the CDN so the bytes always match the
  // latest save.
  let markdown: string;
  try {
    const result = await get(`specs/${access.projectId}/${access.specId}.md`, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200) {
      return notFound("Spec not found");
    }
    markdown = await new Response(result.stream).text();
  } catch {
    return blobUnavailable();
  }

  // Cuid ids are filename-safe (alphanumeric), so no escaping is needed.
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="spec-${access.specId}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
