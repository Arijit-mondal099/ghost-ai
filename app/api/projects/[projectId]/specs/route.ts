// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/specs — persist a generated Markdown spec
//
// Storage model (architecture-context.md + spec 30): Prisma holds metadata
// (the ProjectSpec row with the blob URL in `filePath`); Vercel Blob holds
// the actual Markdown at the deterministic pathname
// `specs/{projectId}/{specId}.md`.
//
// The client calls this after the generate-spec run completes, posting the
// finished Markdown from the run output. The spec id is minted by the row
// create first so the Blob pathname is deterministic.
//
// The Blob store is private, so uploads use `access: "private"` — the stored
// URL is metadata only and never fetched directly (retrieval goes through
// the gated download route, which is why the 201 body carries no URL).
//
// Access: owner OR collaborator (same read gate as the canvas PUT — anyone
// who can edit the canvas can persist a spec). Missing + unauthorized
// collapse to 404, matching `getAccessibleProject`.
//
// GET lists spec metadata for the project (spec 31 prerequisite): the UI
// needs `{ id, createdAt }` rows to render the sidebar list. The stored
// Blob URL is never exposed — content goes through the gated download
// route, which the client also uses for preview text.
// ---------------------------------------------------------------------------

import { currentUser } from "@clerk/nextjs/server";
import { del, put } from "@vercel/blob";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import { badRequest, HttpError, json, notFound, unauthorized } from "@/lib/api/responses";
import { parseSpecSaveBody } from "@/lib/api/validation";

type AccessFailure = { kind: "auth" } | { kind: "notFound" } | { kind: "badId" };
type AccessOk = { kind: "ok"; projectId: string };

async function resolveSpecAccess(
  ctx: RouteContext<"/api/projects/[projectId]/specs">,
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
  // primary — an invite addressed to a secondary email must still resolve
  // (same pattern as the canvas PUT route). Unverified addresses never
  // authorize: otherwise anyone could claim an invited address without
  // proving ownership of it (same predicate as the spec trigger + token
  // routes).
  const userEmails = (me?.emailAddresses ?? [])
    .filter((ea) => ea.verification?.status === "verified")
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
  return { kind: "ok", projectId: trimmedId };
}

function accessResponse(failure: AccessFailure): Response {
  if (failure.kind === "auth") return unauthorized();
  if (failure.kind === "badId") return badRequest("INVALID_ID", "projectId is required");
  return notFound("Project not found");
}

function blobUnavailable(): Response {
  return json(
    { error: { code: "BLOB_UNAVAILABLE", message: "Spec storage is unavailable" } },
    { status: 502 },
  );
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/specs">,
): Promise<Response> {
  const access = await resolveSpecAccess(ctx);
  if (access.kind !== "ok") return accessResponse(access);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = parseSpecSaveBody(body);
  if (!parsed.ok) {
    return badRequest(parsed.code, parsed.message);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) return blobUnavailable();

  // Mint the row first so the Blob pathname (`specs/{projectId}/{specId}.md`)
  // is deterministic. The Blob put cannot join the DB transaction, so a
  // failed upload deletes the placeholder row instead of orphaning it.
  const spec = await prisma.projectSpec.create({
    data: { projectId: access.projectId, filePath: "" },
    select: { id: true },
  });

  // Tracks a completed upload so compensation below can remove the Blob
  // when the metadata update fails after a successful put — otherwise the
  // private object lingers with no row referencing it.
  let uploadedUrl: string | null = null;
  try {
    const blob = await put(`specs/${access.projectId}/${spec.id}.md`, parsed.value.markdown, {
      access: "private",
      contentType: "text/markdown; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    uploadedUrl = blob.url;
    const saved = await prisma.projectSpec.update({
      where: { id: spec.id },
      data: { filePath: blob.url },
      select: { id: true, createdAt: true },
    });
    return json(
      { id: saved.id, createdAt: saved.createdAt.toISOString() },
      {
        status: 201,
        headers: { Location: `/api/projects/${access.projectId}/specs/${saved.id}/download` },
      },
    );
  } catch {
    if (uploadedUrl) {
      try {
        await del(uploadedUrl);
      } catch (delError) {
        console.error("Spec blob compensation delete failed", delError);
      }
    }
    await prisma.projectSpec.deleteMany({ where: { id: spec.id } });
    return blobUnavailable();
  }
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/specs">,
): Promise<Response> {
  const access = await resolveSpecAccess(ctx);
  if (access.kind !== "ok") return accessResponse(access);

  const specs = await prisma.projectSpec.findMany({
    where: { projectId: access.projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  return json(
    {
      specs: specs.map((spec) => ({ id: spec.id, createdAt: spec.createdAt.toISOString() })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
