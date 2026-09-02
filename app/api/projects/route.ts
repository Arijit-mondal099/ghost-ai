// ---------------------------------------------------------------------------
// GET  /api/projects  — list current user's projects
// POST /api/projects  — create a new project
//
// Both handlers validate auth via requireUserId() and return JSON errors
// shaped as { error: { code, message } } via the shared helpers in
// lib/api/responses.ts.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import { badRequest, json, unauthorized } from "@/lib/api/responses";
import { parseCreateProjectBody } from "@/lib/api/validation";

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
  } catch {
    return { kind: "auth" };
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

  return json({ projects });
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

  const project = await prisma.project.create({
    data: { ownerId: auth.userId, name: parsed.value.name },
    select: PROJECT_SELECT,
  });

  return json(project, {
    status: 201,
    headers: { Location: `/api/projects/${project.id}` },
  });
}
