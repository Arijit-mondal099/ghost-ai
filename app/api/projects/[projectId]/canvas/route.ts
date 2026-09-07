// ---------------------------------------------------------------------------
// PUT /api/projects/[projectId]/canvas — persist canvas JSON to Vercel Blob
// GET /api/projects/[projectId]/canvas — load persisted canvas JSON
//
// Storage model (architecture-context.md): Prisma holds metadata + the blob
// URL (`canvasJsonPath`); Vercel Blob holds the actual canvas JSON at the
// fixed pathname `canvas/{projectId}.json` (overwritten on every save).
//
// The Blob store is private, so uploads use `access: "private"` and reads go
// through the SDK `get()` (which authenticates with `BLOB_READ_WRITE_TOKEN`)
// — the stored URL is metadata only and never fetched directly.
//
// Access: owner OR collaborator (same read gate as the collaborators GET —
// anyone who can edit the realtime canvas can autosave). Missing +
// unauthorized collapse to 404, matching `getAccessibleProject`.
// ---------------------------------------------------------------------------

import { currentUser } from "@clerk/nextjs/server";
import { get, put } from "@vercel/blob";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import { badRequest, HttpError, json, notFound, unauthorized } from "@/lib/api/responses";
import { parseCanvasSaveBody } from "@/lib/api/validation";

type AccessFailure = { kind: "auth" } | { kind: "notFound" } | { kind: "badId" };
type AccessOk = { kind: "ok"; projectId: string };

async function resolveCanvasAccess(
  ctx: RouteContext<"/api/projects/[projectId]/canvas">,
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
  // Match against every address on the Clerk user, not just the primary —
  // an invite addressed to a secondary email must still resolve (same
  // pattern as the collaborators GET route).
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
  return { kind: "ok", projectId: trimmedId };
}

function accessResponse(failure: AccessFailure): Response {
  if (failure.kind === "auth") return unauthorized();
  if (failure.kind === "badId") return badRequest("INVALID_ID", "projectId is required");
  return notFound("Project not found");
}

function blobUnavailable(): Response {
  return json(
    { error: { code: "BLOB_UNAVAILABLE", message: "Canvas storage is unavailable" } },
    { status: 502 },
  );
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/canvas">,
): Promise<Response> {
  const access = await resolveCanvasAccess(ctx);
  if (access.kind !== "ok") return accessResponse(access);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = parseCanvasSaveBody(body);
  if (!parsed.ok) {
    return badRequest(parsed.code, parsed.message);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) return blobUnavailable();

  const savedAt = new Date().toISOString();
  let url: string;
  try {
    const blob = await put(
      `canvas/${access.projectId}.json`,
      JSON.stringify({ nodes: parsed.value.nodes, edges: parsed.value.edges, savedAt }),
      {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      },
    );
    url = blob.url;
  } catch {
    return blobUnavailable();
  }

  await prisma.project.update({
    where: { id: access.projectId },
    data: { canvasJsonPath: url },
  });

  return json({ url, savedAt });
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/canvas">,
): Promise<Response> {
  const access = await resolveCanvasAccess(ctx);
  if (access.kind !== "ok") return accessResponse(access);

  const project = await prisma.project.findUnique({
    where: { id: access.projectId },
    select: { canvasJsonPath: true },
  });
  if (!project?.canvasJsonPath) {
    return notFound("No saved canvas for this project");
  }

  // Private store: read by deterministic pathname through the SDK (token
  // auth). `useCache: false` bypasses the CDN so a reload right after a save
  // reads the latest overwrite instead of a stale cached version.
  let saved: unknown;
  try {
    const result = await get(`canvas/${access.projectId}.json`, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200) {
      return notFound("No saved canvas for this project");
    }
    saved = JSON.parse(await new Response(result.stream).text());
  } catch {
    return blobUnavailable();
  }

  return json(saved, { headers: { "Cache-Control": "no-store" } });
}
