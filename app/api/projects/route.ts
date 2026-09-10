// ---------------------------------------------------------------------------
// GET  /api/projects  — list current user's projects
// POST /api/projects  — create a new project
//
// Both handlers validate auth via requireUserId() and return JSON errors
// shaped as { error: { code, message } } via the shared helpers in
// lib/api/responses.ts.
// ---------------------------------------------------------------------------

import { auth as clerkAuth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import { badRequest, HttpError, json, planLimitExceeded, unauthorized } from "@/lib/api/responses";
import { parseCreateProjectBody } from "@/lib/api/validation";
import { canCreateProject, getPlan, planLimitExceededBody } from "@/lib/billing";
import { cacheDel, projectsCacheKey } from "@/lib/redis";

const PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  canvasJsonPath: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function resolveUser(): Promise<{ kind: "ok"; userId: string } | { kind: "auth" }> {
  try {
    const userId = await requireUserId();
    return { kind: "ok", userId };
  } catch (error) {
    if (error instanceof HttpError) return { kind: "auth" };
    throw error;
  }
}

export async function GET(): Promise<Response> {
  const auth = await resolveUser();
  if (auth.kind !== "ok") return unauthorized();

  const projects = await prisma.project.findMany({
    where: { ownerId: auth.userId },
    orderBy: { createdAt: "desc" },
    select: PROJECT_SELECT,
  });

  return json({ projects }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveUser();
  if (auth.kind !== "ok") return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = parseCreateProjectBody(body);
  if (!parsed.ok) {
    return badRequest(parsed.code, parsed.message);
  }

  // Plan enforcement (spec 36): Clerk is the source of truth for the plan;
  // the cap counts owned projects only. Shared/collaborator projects never
  // count. This route is the enforcement boundary — UI bypass must not work.
  const { has } = await clerkAuth();
  const plan = getPlan((options) => has(options));
  const ownedCount = await prisma.project.count({ where: { ownerId: auth.userId } });
  if (!canCreateProject(ownedCount, plan)) {
    return planLimitExceeded({ ...planLimitExceededBody(plan) });
  }

  const project = await prisma.project.create({
    data: { ownerId: auth.userId, name: parsed.value.name },
    select: PROJECT_SELECT,
  });

  // Invalidate (spec 33): the owner's project list changed. Fail-open.
  await cacheDel(projectsCacheKey(auth.userId));

  return json(project, {
    status: 201,
    headers: { Location: `/api/projects/${project.id}` },
  });
}
